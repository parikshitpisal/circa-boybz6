import { Router } from 'express';
import { ApplicationController } from '../controllers/application.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateApplicationRequest } from '../middleware/validation.middleware';
import { rateLimitMiddleware } from '../middleware/rateLimit.middleware';
import { CacheService } from '../services/cache.service';
import { loggerInstance as logger } from '../utils/logger';
import { config } from '../config';
import { HTTP_STATUS } from '../../../../shared/constants';

// Cache TTL constants
const CACHE_TTL = {
  LIST: 300, // 5 minutes for list endpoints
  DETAIL: 60, // 1 minute for detail endpoints
};

// Pagination constants
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

/**
 * Initializes application routes with comprehensive security and caching
 * @param applicationController Controller instance for application operations
 * @returns Configured Express router
 */
export function initializeApplicationRouter(
  applicationController: ApplicationController,
  cacheService: CacheService
): Router {
  const router = Router();
  
  // Apply rate limiting middleware
  const rateLimiter = rateLimitMiddleware(cacheService, logger);

  /**
   * GET /applications
   * Retrieves paginated list of applications with filtering and caching
   */
  router.get(
    '/',
    authenticate,
    authorize(['admin', 'operator']),
    rateLimiter,
    async (req, res, next) => {
      try {
        // Parse and validate query parameters
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(
          parseInt(req.query.limit as string) || DEFAULT_PAGE_SIZE,
          MAX_PAGE_SIZE
        );
        const status = req.query.status as string;
        const sortBy = req.query.sortBy as string || 'createdAt';
        const sortOrder = (req.query.sortOrder as string || 'desc').toLowerCase();

        // Generate cache key based on query parameters
        const cacheKey = `applications:${req.user!.id}:${page}:${limit}:${status}:${sortBy}:${sortOrder}`;

        // Check cache first
        const cachedData = await cacheService.get(cacheKey);
        if (cachedData) {
          return res.json(cachedData);
        }

        await applicationController.getApplications(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /applications/:id
   * Retrieves single application by ID with caching
   */
  router.get(
    '/:id',
    authenticate,
    authorize(['admin', 'operator']),
    rateLimiter,
    async (req, res, next) => {
      try {
        const { id } = req.params;
        
        // Generate cache key
        const cacheKey = `application:${id}`;

        // Check cache first
        const cachedData = await cacheService.get(cacheKey);
        if (cachedData) {
          return res.json(cachedData);
        }

        await applicationController.getApplicationById(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /applications
   * Creates new application with validation
   */
  router.post(
    '/',
    authenticate,
    authorize(['admin', 'operator']),
    rateLimiter,
    validateApplicationRequest,
    async (req, res, next) => {
      try {
        await applicationController.createApplication(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * PATCH /applications/:id/status
   * Updates application status with authorization checks
   */
  router.patch(
    '/:id/status',
    authenticate,
    authorize(['admin']), // Only admins can update status
    rateLimiter,
    async (req, res, next) => {
      try {
        const { id } = req.params;
        const { status } = req.body;

        if (!id || !status) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            error: 'Application ID and status are required'
          });
        }

        // Invalidate caches on status update
        await cacheService.del(`application:${id}`);
        await cacheService.del('applications:*');

        await applicationController.updateApplicationStatus(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

// Export configured router
export default initializeApplicationRouter;