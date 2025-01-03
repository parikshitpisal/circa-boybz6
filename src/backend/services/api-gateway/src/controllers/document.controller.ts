import { Controller, Post, Get, Delete, Param, Body, Req, Res, UseGuards, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import * as multer from 'multer';
import { Logger } from 'winston';
import { Counter, Histogram } from 'prom-client';
import { ValidateSecureUrl } from '@nestjs/security';
import { Document, DocumentMetadata } from '../interfaces/document.interface';
import { QueueService } from '../services/queue.service';
import { HTTP_STATUS, DOCUMENT_TYPES, MAX_FILE_SIZE_MB } from '../../../../shared/constants';
import { config } from '../config';

@Controller('/api/v1/documents')
export class DocumentController {
  private readonly logger: Logger;
  private readonly upload: multer.Multer;
  private readonly documentCounter: Counter;
  private readonly processingDuration: Histogram;

  constructor(
    private readonly queueService: QueueService,
    logger: Logger
  ) {
    this.logger = logger;
    
    // Initialize file upload middleware with security checks
    this.upload = multer({
      limits: {
        fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
        files: 1
      },
      fileFilter: this.validateFileType
    });

    // Initialize metrics collectors
    this.documentCounter = new Counter({
      name: 'document_uploads_total',
      help: 'Total number of document uploads',
      labelNames: ['type', 'status']
    });

    this.processingDuration = new Histogram({
      name: 'document_processing_duration_seconds',
      help: 'Document processing duration in seconds',
      buckets: [0.1, 0.5, 1, 2, 5, 10]
    });
  }

  @Post('/upload')
  @UseGuards(AuthGuard)
  async uploadDocument(@Req() req: Request, @Res() res: Response): Promise<Response> {
    const processingTimer = this.processingDuration.startTimer();
    
    try {
      // Handle file upload with configured middleware
      await new Promise((resolve, reject) => {
        this.upload.single('document')(req, res, (err) => {
          if (err) reject(err);
          resolve(true);
        });
      });

      if (!req.file) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'No document provided'
        });
      }

      // Extract and validate metadata
      const metadata: DocumentMetadata = {
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        pageCount: 0, // Will be updated during processing
        processingDuration: 0,
        extractedData: {},
        validationErrors: [],
        processingEngine: 'default',
        processingAttempts: 0,
        confidenceScores: {},
        processingSteps: [],
        validationRules: {}
      };

      // Create document record
      const document: Document = {
        applicationId: req.body.applicationId,
        storagePath: `documents/${req.file.filename}`,
        ocrConfidence: 0,
        metadata,
        sourceEmail: req.body.sourceEmail,
        originalFilename: req.file.originalname,
        processingPriority: req.body.priority || 'normal',
        tags: []
      };

      // Queue document for processing
      await this.queueService.publishDocument(document, {
        priority: this.getPriorityLevel(document.processingPriority),
        persistent: true
      });

      // Update metrics
      this.documentCounter.inc({ type: document.metadata.mimeType, status: 'success' });
      processingTimer();

      // Return success response with secure URLs
      return res.status(HTTP_STATUS.OK).json({
        id: document.applicationId,
        status: 'queued',
        downloadUrl: await this.generateSecureUrl(document.storagePath, 'download'),
        previewUrl: await this.generateSecureUrl(document.storagePath, 'preview')
      });

    } catch (error) {
      this.logger.error('Document upload failed', {
        error,
        applicationId: req.body.applicationId
      });

      this.documentCounter.inc({ type: 'unknown', status: 'error' });
      processingTimer();

      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Document upload failed',
        code: 'UPLOAD_ERROR'
      });
    }
  }

  @Get('/:id')
  @UseGuards(AuthGuard)
  async getDocument(@Param('id') id: string, @Res() res: Response): Promise<Response> {
    try {
      // Validate document access permissions
      if (!await this.validateDocumentAccess(id, req.user)) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          error: 'Access denied'
        });
      }

      // Return document details with secure URLs
      const document = await this.documentService.findById(id);
      return res.status(HTTP_STATUS.OK).json({
        ...document,
        downloadUrl: await this.generateSecureUrl(document.storagePath, 'download'),
        previewUrl: await this.generateSecureUrl(document.storagePath, 'preview')
      });

    } catch (error) {
      this.logger.error('Failed to retrieve document', { id, error });
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Document retrieval failed'
      });
    }
  }

  @Delete('/:id')
  @UseGuards(AuthGuard, AdminGuard)
  async deleteDocument(@Param('id') id: string, @Res() res: Response): Promise<Response> {
    try {
      await this.documentService.deleteDocument(id);
      return res.status(HTTP_STATUS.OK).json({
        message: 'Document deleted successfully'
      });
    } catch (error) {
      this.logger.error('Document deletion failed', { id, error });
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Document deletion failed'
      });
    }
  }

  private validateFileType(req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback): void {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.mimetype)) {
      cb(new Error('Invalid file type'));
      return;
    }
    cb(null, true);
  }

  private getPriorityLevel(priority: string): number {
    const priorities = {
      high: 9,
      normal: 5,
      low: 1
    };
    return priorities[priority] || 5;
  }

  @ValidateSecureUrl()
  private async generateSecureUrl(path: string, type: 'download' | 'preview'): Promise<string> {
    const expiryTime = type === 'download' ? 300 : 3600; // 5 minutes for download, 1 hour for preview
    return await this.storageService.generateSignedUrl(path, expiryTime);
  }

  private async validateDocumentAccess(documentId: string, user: any): Promise<boolean> {
    // Implement access control logic based on user roles and document ownership
    return true; // Placeholder implementation
  }
}