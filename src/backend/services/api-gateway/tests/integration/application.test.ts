import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect } from '@jest/globals';
import supertest from 'supertest';
import { faker } from '@faker-js/faker';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { app } from '../../src/app';
import { IApplication } from '../../src/interfaces/application.interface';
import { APPLICATION_STATUS } from '../../../shared/constants';

const request = supertest(app);

describe('Application API Integration Tests', () => {
  // Test data storage
  let adminToken: string;
  let operatorToken: string;
  let auditorToken: string;
  let testApplication: IApplication;
  let testApplicationId: string;

  // Setup test environment
  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/test');

    // Generate test tokens
    adminToken = generateTestToken('admin');
    operatorToken = generateTestToken('operator');
    auditorToken = generateTestToken('auditor');
  });

  // Cleanup after all tests
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  });

  // Reset test data before each test
  beforeEach(async () => {
    testApplication = generateTestApplication();
    const response = await request
      .post('/api/v1/applications')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(testApplication);
    testApplicationId = response.body.id;
  });

  // Cleanup after each test
  afterEach(async () => {
    await mongoose.connection.collection('applications').deleteMany({});
  });

  describe('GET /applications', () => {
    it('should return paginated applications with valid admin token', async () => {
      const response = await request
        .get('/api/v1/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return filtered applications for operator token', async () => {
      const response = await request
        .get('/api/v1/applications')
        .set('Authorization', `Bearer ${operatorToken}`)
        .query({ status: APPLICATION_STATUS.PENDING });

      expect(response.status).toBe(200);
      expect(response.body.data.every((app: IApplication) => 
        app.status === APPLICATION_STATUS.PENDING
      )).toBe(true);
    });

    it('should return 401 without token', async () => {
      const response = await request.get('/api/v1/applications');
      expect(response.status).toBe(401);
    });

    it('should return 403 for insufficient permissions', async () => {
      const response = await request
        .get('/api/v1/applications')
        .set('Authorization', `Bearer ${auditorToken}`);
      expect(response.status).toBe(403);
    });

    it('should respect rate limits per user role', async () => {
      const requests = Array(150).fill(null).map(() => 
        request
          .get('/api/v1/applications')
          .set('Authorization', `Bearer ${operatorToken}`)
      );

      const responses = await Promise.all(requests);
      const tooManyRequests = responses.filter(r => r.status === 429);
      expect(tooManyRequests.length).toBeGreaterThan(0);
    });
  });

  describe('GET /applications/:id', () => {
    it('should return application by ID with valid token', async () => {
      const response = await request
        .get(`/api/v1/applications/${testApplicationId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', testApplicationId);
      expect(response.body).toHaveProperty('merchantData');
      expect(response.body).toHaveProperty('status');
    });

    it('should mask sensitive data for operator role', async () => {
      const response = await request
        .get(`/api/v1/applications/${testApplicationId}`)
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.merchantData.ownerInfo.ssn).toMatch(/^\*+\d{4}$/);
      expect(response.body.merchantData.financialInfo.bankAccountNumber).toMatch(/^\*+\d{4}$/);
    });

    it('should return 404 for non-existent application', async () => {
      const response = await request
        .get('/api/v1/applications/nonexistent-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /applications', () => {
    it('should create application with valid data and token', async () => {
      const newApplication = generateTestApplication();
      const response = await request
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newApplication);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe(APPLICATION_STATUS.PENDING);
    });

    it('should validate required fields', async () => {
      const invalidApplication = {
        ...generateTestApplication(),
        merchantData: { businessName: '' }
      };

      const response = await request
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidApplication);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle concurrent requests', async () => {
      const requests = Array(5).fill(null).map(() => 
        request
          .post('/api/v1/applications')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(generateTestApplication())
      );

      const responses = await Promise.all(requests);
      expect(responses.every(r => r.status === 201)).toBe(true);
      expect(new Set(responses.map(r => r.body.id)).size).toBe(5);
    });
  });

  describe('PATCH /applications/:id/status', () => {
    it('should update status with admin token', async () => {
      const response = await request
        .patch(`/api/v1/applications/${testApplicationId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: APPLICATION_STATUS.PROCESSING });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(APPLICATION_STATUS.PROCESSING);
    });

    it('should validate status transitions', async () => {
      const response = await request
        .patch(`/api/v1/applications/${testApplicationId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: APPLICATION_STATUS.COMPLETED });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid status transition');
    });

    it('should maintain audit trail', async () => {
      const response = await request
        .patch(`/api/v1/applications/${testApplicationId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: APPLICATION_STATUS.PROCESSING });

      expect(response.body.metadata.processingHistory).toHaveLength(1);
      expect(response.body.metadata.processingHistory[0]).toHaveProperty('status');
      expect(response.body.metadata.processingHistory[0]).toHaveProperty('timestamp');
    });
  });
});

// Helper function to generate test tokens
function generateTestToken(role: string): string {
  return jwt.sign(
    { 
      id: faker.string.uuid(),
      role,
      permissions: role === 'admin' ? ['*'] : ['read', 'write']
    },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
}

// Helper function to generate test application data
function generateTestApplication(): IApplication {
  return {
    status: APPLICATION_STATUS.PENDING,
    emailSource: faker.internet.email(),
    merchantData: {
      businessName: faker.company.name(),
      ein: '12-3456789',
      dba: faker.company.name(),
      address: {
        street: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state({ abbreviated: true }),
        zipCode: faker.location.zipCode(),
        isVerified: false
      },
      ownerInfo: {
        name: faker.person.fullName(),
        ssn: '123-45-6789',
        dob: faker.date.past().toISOString(),
        email: faker.internet.email(),
        phone: faker.phone.number()
      },
      financialInfo: {
        monthlyRevenue: faker.number.int({ min: 10000, max: 1000000 }),
        requestedAmount: faker.number.int({ min: 5000, max: 100000 }),
        bankAccountNumber: faker.finance.accountNumber(),
        routingNumber: '123456789'
      }
    },
    documents: [faker.string.uuid()],
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
}