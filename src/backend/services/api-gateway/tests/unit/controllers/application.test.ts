import { ApplicationController } from '../../src/controllers/application.controller';
import { AuthService } from '../../src/services/auth.service';
import { QueueService } from '../../src/services/queue.service';
import { CacheService } from '../../src/services/cache.service';
import { IApplication } from '../../src/interfaces/application.interface';
import { APPLICATION_STATUS, HTTP_STATUS } from '../../../../shared/constants';
import { faker } from '@faker-js/faker';
import { Request, Response } from 'express';

// Mock services
jest.mock('../../src/services/auth.service');
jest.mock('../../src/services/queue.service');
jest.mock('../../src/services/cache.service');

describe('ApplicationController', () => {
  let applicationController: ApplicationController;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockQueueService: jest.Mocked<QueueService>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  // Test data generators
  const generateMerchantData = () => ({
    businessName: faker.company.name(),
    ein: faker.string.numeric(9),
    dba: faker.company.name(),
    address: {
      street: faker.location.streetAddress(),
      city: faker.location.city(),
      state: faker.location.state({ abbreviated: true }),
      zipCode: faker.location.zipCode(),
      isVerified: true
    },
    ownerInfo: {
      name: faker.person.fullName(),
      ssn: `${faker.string.numeric(3)}-${faker.string.numeric(2)}-${faker.string.numeric(4)}`,
      dob: faker.date.past().toISOString(),
      email: faker.internet.email(),
      phone: faker.string.numeric(10)
    },
    financialInfo: {
      monthlyRevenue: faker.number.int({ min: 10000, max: 1000000 }),
      requestedAmount: faker.number.int({ min: 5000, max: 500000 }),
      bankAccountNumber: faker.string.numeric(10),
      routingNumber: faker.string.numeric(9)
    }
  });

  const generateApplication = (status = APPLICATION_STATUS.PENDING): IApplication => ({
    id: faker.string.uuid(),
    createdAt: new Date(),
    updatedAt: new Date(),
    status,
    emailSource: faker.internet.email(),
    merchantData: generateMerchantData(),
    documents: [faker.string.uuid(), faker.string.uuid()],
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
  });

  beforeEach(() => {
    // Reset mocks
    mockAuthService = {
      verifyToken: jest.fn(),
      checkPermissions: jest.fn()
    } as unknown as jest.Mocked<AuthService>;

    mockQueueService = {
      publishDocument: jest.fn()
    } as unknown as jest.Mocked<QueueService>;

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn()
    } as unknown as jest.Mocked<CacheService>;

    // Initialize controller
    applicationController = new ApplicationController(
      mockAuthService,
      mockQueueService,
      mockCacheService
    );

    // Setup request/response mocks
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    mockRequest = {
      ip: '127.0.0.1',
      headers: {
        authorization: 'Bearer mock-token'
      }
    };
  });

  describe('getApplications', () => {
    it('should return paginated applications with valid token', async () => {
      // Arrange
      const applications = [generateApplication(), generateApplication()];
      const mockUser = { id: '123', role: 'admin' };
      mockAuthService.verifyToken.mockResolvedValue(mockUser);
      mockRequest.query = { page: '1', limit: '10' };
      
      // Mock internal methods
      (applicationController as any).fetchApplications = jest.fn().mockResolvedValue(applications);
      (applicationController as any).getApplicationsCount = jest.fn().mockResolvedValue(2);

      // Act
      await applicationController.getApplications(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.json).toHaveBeenCalledWith({
        data: applications,
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1
      });
    });

    it('should handle unauthorized access', async () => {
      // Arrange
      mockRequest.headers = {};

      // Act
      await applicationController.getApplications(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.UNAUTHORIZED);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });

    it('should respect rate limiting', async () => {
      // Arrange
      const rateLimitError = new Error('Rate limit exceeded');
      (applicationController as any).rateLimiter.consume = jest.fn().mockRejectedValue(rateLimitError);

      // Act
      await applicationController.getApplications(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.TOO_MANY_REQUESTS);
    });
  });

  describe('getApplicationById', () => {
    it('should return application details for valid ID', async () => {
      // Arrange
      const application = generateApplication();
      const mockUser = { id: '123', role: 'admin' };
      mockAuthService.verifyToken.mockResolvedValue(mockUser);
      mockRequest.params = { id: application.id };
      
      (applicationController as any).fetchApplicationById = jest.fn().mockResolvedValue(application);

      // Act
      await applicationController.getApplicationById(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.json).toHaveBeenCalledWith(application);
    });

    it('should handle non-existent application', async () => {
      // Arrange
      mockAuthService.verifyToken.mockResolvedValue({ id: '123', role: 'admin' });
      mockRequest.params = { id: 'non-existent' };
      
      (applicationController as any).fetchApplicationById = jest.fn().mockResolvedValue(null);

      // Act
      await applicationController.getApplicationById(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND);
    });
  });

  describe('createApplication', () => {
    it('should create valid application with documents', async () => {
      // Arrange
      const newApplication = generateApplication();
      mockRequest.body = {
        merchantData: newApplication.merchantData,
        documents: newApplication.documents,
        emailSource: newApplication.emailSource
      };

      mockAuthService.verifyToken.mockResolvedValue({ id: '123', role: 'admin' });
      (applicationController as any).saveApplication = jest.fn().mockResolvedValue(newApplication);

      // Act
      await applicationController.createApplication(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockQueueService.publishDocument).toHaveBeenCalledTimes(2);
      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(newApplication);
    });

    it('should validate required fields', async () => {
      // Arrange
      mockRequest.body = {
        merchantData: { businessName: 'Test' } // Missing required fields
      };

      // Act
      await applicationController.createApplication(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST);
    });
  });

  describe('updateApplicationStatus', () => {
    it('should update application status with valid permissions', async () => {
      // Arrange
      const application = generateApplication();
      mockRequest.params = { id: application.id };
      mockRequest.body = { status: APPLICATION_STATUS.COMPLETED };
      
      mockAuthService.verifyToken.mockResolvedValue({ id: '123', role: 'admin' });
      (applicationController as any).fetchApplicationById = jest.fn().mockResolvedValue(application);
      (applicationController as any).updateApplication = jest.fn().mockResolvedValue({
        ...application,
        status: APPLICATION_STATUS.COMPLETED
      });

      // Act
      await applicationController.updateApplicationStatus(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockCacheService.del).toHaveBeenCalledTimes(2);
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('should prevent invalid status transitions', async () => {
      // Arrange
      mockRequest.params = { id: faker.string.uuid() };
      mockRequest.body = { status: 'INVALID_STATUS' };

      // Act
      await applicationController.updateApplicationStatus(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Arrange
      const dbError = new Error('Database connection failed');
      (applicationController as any).fetchApplications = jest.fn().mockRejectedValue(dbError);

      // Act
      await applicationController.getApplications(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR);
    });

    it('should handle queue service errors', async () => {
      // Arrange
      const queueError = new Error('Queue service unavailable');
      mockQueueService.publishDocument.mockRejectedValue(queueError);
      
      const newApplication = generateApplication();
      mockRequest.body = {
        merchantData: newApplication.merchantData,
        documents: newApplication.documents,
        emailSource: newApplication.emailSource
      };

      // Act
      await applicationController.createApplication(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR);
    });
  });

  describe('Cache Integration', () => {
    it('should use cached data when available', async () => {
      // Arrange
      const cachedApplication = generateApplication();
      mockCacheService.get.mockResolvedValue(cachedApplication);
      mockRequest.params = { id: cachedApplication.id };

      // Act
      await applicationController.getApplicationById(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.json).toHaveBeenCalledWith(cachedApplication);
      expect(applicationController['fetchApplicationById']).not.toHaveBeenCalled();
    });

    it('should cache new data when not in cache', async () => {
      // Arrange
      const application = generateApplication();
      mockCacheService.get.mockResolvedValue(null);
      mockRequest.params = { id: application.id };
      
      (applicationController as any).fetchApplicationById = jest.fn().mockResolvedValue(application);

      // Act
      await applicationController.getApplicationById(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockCacheService.set).toHaveBeenCalled();
    });
  });
});