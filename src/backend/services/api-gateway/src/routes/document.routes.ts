import express, { Router, Request, Response } from 'express'; // ^4.18.0
import multer from 'multer'; // ^1.4.5-lts.1
import rateLimit from 'express-rate-limit'; // ^6.7.0
import compression from 'compression'; // ^1.7.4
import helmet from 'helmet'; // ^7.0.0
import { DocumentController } from '../controllers/document.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateDocumentRequest } from '../middleware/validation.middleware';
import { logger } from '../utils/logger';
import { config } from '../config';
import { HTTP_STATUS } from '../../../../shared/constants';

// Constants for document handling
const ALLOWED_FILE_TYPES = ['.pdf', '.jpg', '.jpeg', '.png'];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 100;
const REQUEST_TIMEOUT = 30000; // 30 seconds

/**
 * Configures and returns document routes with comprehensive security and monitoring
 * @param documentController Initialized DocumentController instance
 * @returns Configured Express router
 */
export function configureDocumentRoutes(documentController: DocumentController): Router {
    const router = express.Router();

    // Apply security middleware
    router.use(helmet({
        contentSecurityPolicy: true,
        crossOriginEmbedderPolicy: true,
        crossOriginOpenerPolicy: true,
        crossOriginResourcePolicy: true,
        dnsPrefetchControl: true,
        frameguard: true,
        hidePoweredBy: true,
        hsts: true,
        ieNoOpen: true,
        noSniff: true,
        originAgentCluster: true,
        permittedCrossDomainPolicies: true,
        referrerPolicy: true,
        xssFilter: true
    }));

    // Enable compression
    router.use(compression());

    // Configure multer for file uploads
    const upload = multer({
        limits: {
            fileSize: MAX_FILE_SIZE,
            files: 1
        },
        fileFilter: (req, file, cb) => {
            const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
            if (ALLOWED_FILE_TYPES.includes(ext)) {
                cb(null, true);
            } else {
                cb(new Error('Invalid file type'));
            }
        }
    });

    // Rate limiting middleware
    const uploadLimiter = rateLimit({
        windowMs: RATE_LIMIT_WINDOW,
        max: RATE_LIMIT_MAX,
        message: { error: 'Too many upload requests' },
        standardHeaders: true,
        legacyHeaders: false
    });

    const downloadLimiter = rateLimit({
        windowMs: RATE_LIMIT_WINDOW,
        max: RATE_LIMIT_MAX * 2, // More lenient for downloads
        message: { error: 'Too many download requests' },
        standardHeaders: true,
        legacyHeaders: false
    });

    // Document upload endpoint
    router.post('/upload',
        authenticate,
        authorize(['operator', 'admin']),
        uploadLimiter,
        upload.single('document'),
        validateDocumentRequest,
        async (req: Request, res: Response) => {
            try {
                const startTime = Date.now();
                logger.info('Document upload initiated', {
                    userId: req.user?.id,
                    contentType: req.file?.mimetype,
                    fileSize: req.file?.size
                });

                const result = await documentController.uploadDocument(req, res);

                logger.info('Document upload completed', {
                    userId: req.user?.id,
                    duration: Date.now() - startTime
                });

                return result;
            } catch (error) {
                logger.error('Document upload failed', {
                    userId: req.user?.id,
                    error: error.message
                });
                return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                    error: 'Document upload failed',
                    code: 'UPLOAD_ERROR'
                });
            }
        }
    );

    // Document retrieval endpoint
    router.get('/:id',
        authenticate,
        authorize(['operator', 'admin', 'auditor']),
        downloadLimiter,
        async (req: Request, res: Response) => {
            try {
                const startTime = Date.now();
                logger.info('Document retrieval initiated', {
                    userId: req.user?.id,
                    documentId: req.params.id
                });

                const result = await documentController.getDocument(req.params.id, res);

                logger.info('Document retrieval completed', {
                    userId: req.user?.id,
                    documentId: req.params.id,
                    duration: Date.now() - startTime
                });

                return result;
            } catch (error) {
                logger.error('Document retrieval failed', {
                    userId: req.user?.id,
                    documentId: req.params.id,
                    error: error.message
                });
                return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                    error: 'Document retrieval failed',
                    code: 'RETRIEVAL_ERROR'
                });
            }
        }
    );

    // Document status endpoint
    router.get('/:id/status',
        authenticate,
        authorize(['operator', 'admin', 'auditor']),
        downloadLimiter,
        async (req: Request, res: Response) => {
            try {
                const result = await documentController.getDocumentStatus(req.params.id, res);
                return result;
            } catch (error) {
                logger.error('Document status check failed', {
                    userId: req.user?.id,
                    documentId: req.params.id,
                    error: error.message
                });
                return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                    error: 'Document status check failed',
                    code: 'STATUS_ERROR'
                });
            }
        }
    );

    // Document deletion endpoint
    router.delete('/:id',
        authenticate,
        authorize(['admin']),
        async (req: Request, res: Response) => {
            try {
                logger.info('Document deletion initiated', {
                    userId: req.user?.id,
                    documentId: req.params.id
                });

                const result = await documentController.deleteDocument(req.params.id, res);

                logger.info('Document deletion completed', {
                    userId: req.user?.id,
                    documentId: req.params.id
                });

                return result;
            } catch (error) {
                logger.error('Document deletion failed', {
                    userId: req.user?.id,
                    documentId: req.params.id,
                    error: error.message
                });
                return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                    error: 'Document deletion failed',
                    code: 'DELETION_ERROR'
                });
            }
        }
    );

    // Error handling middleware
    router.use((error: Error, req: Request, res: Response, next: Function) => {
        logger.error('Document route error', {
            error: error.message,
            stack: error.stack,
            path: req.path
        });

        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            error: 'An unexpected error occurred',
            code: 'ROUTE_ERROR'
        });
    });

    return router;
}

export default configureDocumentRoutes;