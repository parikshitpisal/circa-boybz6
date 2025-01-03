import { injectable } from 'inversify';
import { Request, Response } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import winston from 'winston';
import Joi from 'joi';
import { IApplication, IMerchantData } from '../interfaces/application.interface';
import { AuthService } from '../services/auth.service';
import { QueueService } from '../services/queue.service';
import { CacheService } from '../services/cache.service';
import { APPLICATION_STATUS, API_RATE_LIMITS, HTTP_STATUS } from '../../../../shared/constants';

// Application validation schema
const applicationSchema = Joi.object({
  merchantData: Joi.object({
    businessName: Joi.string().required(),
    ein: Joi.string().required(),
    dba: Joi.string().allow(''),
    address: Joi.object({
      street: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string().length(2).required(),
      zipCode: Joi.string().pattern(/^\d{5}(-\d{4})?$/).required(),
      isVerified: Joi.boolean()
    }).required(),
    ownerInfo: Joi.object({
      name: Joi.string().required(),
      ssn: Joi.string().pattern(/^\d{3}-\d{2}-\d{4}$/).required(),
      dob: Joi.string().isoDate().required(),
      email: Joi.string().email().required(),
      phone: Joi.string().pattern(/^\d{10}$/).required()
    }).required(),
    financialInfo: Joi.object({
      monthlyRevenue: Joi.number().positive().required(),
      requestedAmount: Joi.number().positive().required(),
      bankAccountNumber: Joi.string().required(),
      routingNumber: Joi.string().length(9).required()
    }).required()
  }).required(),
  documents: Joi.array().items(Joi.string().uuid()).min(1).required(),
  emailSource: Joi.string().email().required()
});

@injectable()
export class ApplicationController {
  private readonly logger: winston.Logger;
  private readonly rateLimiter: RateLimiterMemory;

  constructor(
    private readonly authService: AuthService,
    private readonly queueService: QueueService,
    private readonly cacheService: CacheService
  ) {
    // Initialize logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'application-controller' },
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'error.log', level: 'error' })
      ]
    });

    // Initialize rate limiter
    this.rateLimiter = new RateLimiterMemory({
      points: API_RATE_LIMITS.STANDARD_TIER.hourlyLimit,
      duration: API_RATE_LIMITS.STANDARD_TIER.windowSeconds
    });
  }

  /**
   * Retrieves paginated list of applications with filtering
   */
  public async getApplications(req: Request, res: Response): Promise<void> {
    try {
      // Rate limiting check
      await this.rateLimiter.consume(req.ip);

      // Verify authentication
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'Authentication required' });
        return;
      }
      const user = await this.authService.verifyToken(token);

      // Parse query parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
      const status = req.query.status as APPLICATION_STATUS;
      const sortBy = req.query.sortBy as string || 'createdAt';
      const sortOrder = req.query.sortOrder as 'asc' | 'desc' || 'desc';

      // Check cache
      const cacheKey = `applications:${user.id}:${page}:${limit}:${status}:${sortBy}:${sortOrder}`;
      const cachedResult = await this.cacheService.get(cacheKey);
      if (cachedResult) {
        res.json(cachedResult);
        return;
      }

      // Apply filters based on user role
      const filters: any = {};
      if (status) {
        filters.status = status;
      }
      if (user.role !== 'admin') {
        filters.assignedTo = user.id;
      }

      // Fetch applications from database (implementation depends on your data layer)
      const applications = await this.fetchApplications(filters, page, limit, sortBy, sortOrder);
      const total = await this.getApplicationsCount(filters);

      const result = {
        data: applications,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };

      // Cache results
      await this.cacheService.set(cacheKey, result, { ttl: 300 });

      res.json(result);
    } catch (error) {
      this.logger.error('Error fetching applications:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to fetch applications' });
    }
  }

  /**
   * Retrieves single application by ID
   */
  public async getApplicationById(req: Request, res: Response): Promise<void> {
    try {
      await this.rateLimiter.consume(req.ip);

      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'Authentication required' });
        return;
      }
      const user = await this.authService.verifyToken(token);

      const { id } = req.params;
      if (!id) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Application ID required' });
        return;
      }

      // Check cache
      const cacheKey = `application:${id}`;
      const cachedApplication = await this.cacheService.get(cacheKey);
      if (cachedApplication) {
        res.json(cachedApplication);
        return;
      }

      const application = await this.fetchApplicationById(id);
      if (!application) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Application not found' });
        return;
      }

      // Check authorization
      if (user.role !== 'admin' && application.assignedTo !== user.id) {
        res.status(HTTP_STATUS.FORBIDDEN).json({ error: 'Access denied' });
        return;
      }

      // Cache application
      await this.cacheService.set(cacheKey, application, { ttl: 60 });

      res.json(application);
    } catch (error) {
      this.logger.error('Error fetching application:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to fetch application' });
    }
  }

  /**
   * Creates new application with validation
   */
  public async createApplication(req: Request, res: Response): Promise<void> {
    try {
      await this.rateLimiter.consume(req.ip);

      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'Authentication required' });
        return;
      }
      await this.authService.verifyToken(token);

      // Validate request body
      const { error, value } = applicationSchema.validate(req.body);
      if (error) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({ error: error.details[0].message });
        return;
      }

      // Create application
      const application: Partial<IApplication> = {
        ...value,
        status: APPLICATION_STATUS.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          processingDuration: 0,
          extractedData: {},
          validationErrors: [],
          processingHistory: [],
          auditTrail: []
        },
        processingMetrics: {
          ocrConfidence: 0,
          dataExtractionAccuracy: 0,
          processingAttempts: 0,
          timestamps: []
        }
      };

      // Save application (implementation depends on your data layer)
      const savedApplication = await this.saveApplication(application);

      // Queue documents for processing
      for (const documentId of savedApplication.documents) {
        await this.queueService.publishDocument({
          id: documentId,
          type: 'ISO_APPLICATION',
          status: APPLICATION_STATUS.PENDING,
          processedAt: new Date(),
          metadata: {
            applicationId: savedApplication.id
          }
        });
      }

      // Invalidate cache
      await this.cacheService.del('applications:*');

      res.status(HTTP_STATUS.OK).json(savedApplication);
    } catch (error) {
      this.logger.error('Error creating application:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to create application' });
    }
  }

  /**
   * Updates application status with validation
   */
  public async updateApplicationStatus(req: Request, res: Response): Promise<void> {
    try {
      await this.rateLimiter.consume(req.ip);

      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'Authentication required' });
        return;
      }
      const user = await this.authService.verifyToken(token);

      const { id } = req.params;
      const { status } = req.body;

      if (!Object.values(APPLICATION_STATUS).includes(status)) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Invalid status' });
        return;
      }

      const application = await this.fetchApplicationById(id);
      if (!application) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Application not found' });
        return;
      }

      // Check authorization
      if (user.role !== 'admin' && application.assignedTo !== user.id) {
        res.status(HTTP_STATUS.FORBIDDEN).json({ error: 'Access denied' });
        return;
      }

      // Update application status
      const updatedApplication = await this.updateApplication(id, {
        status,
        updatedAt: new Date(),
        'metadata.processingHistory': [
          ...application.metadata.processingHistory,
          {
            status,
            timestamp: new Date(),
            performedBy: user.id
          }
        ]
      });

      // Invalidate cache
      await this.cacheService.del(`application:${id}`);
      await this.cacheService.del('applications:*');

      res.json(updatedApplication);
    } catch (error) {
      this.logger.error('Error updating application status:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to update application status' });
    }
  }

  // Note: These methods would be implemented based on your data layer
  private async fetchApplications(filters: any, page: number, limit: number, sortBy: string, sortOrder: string): Promise<IApplication[]> {
    throw new Error('Method not implemented');
  }

  private async getApplicationsCount(filters: any): Promise<number> {
    throw new Error('Method not implemented');
  }

  private async fetchApplicationById(id: string): Promise<IApplication | null> {
    throw new Error('Method not implemented');
  }

  private async saveApplication(application: Partial<IApplication>): Promise<IApplication> {
    throw new Error('Method not implemented');
  }

  private async updateApplication(id: string, updates: Partial<IApplication>): Promise<IApplication> {
    throw new Error('Method not implemented');
  }
}