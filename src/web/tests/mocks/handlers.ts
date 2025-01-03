import { rest, RequestHandler } from 'msw';
import { API_ENDPOINTS, HTTP_STATUS } from '../../src/constants/api.constants';

// Mock data stores
const mockApplications = [
  {
    id: '1',
    businessName: 'ABC Corp',
    status: 'pending',
    createdAt: new Date().toISOString(),
    email: 'contact@abccorp.com'
  },
  {
    id: '2',
    businessName: 'XYZ LLC',
    status: 'processing',
    createdAt: new Date().toISOString(),
    email: 'info@xyzllc.com'
  }
];

const mockDocuments = [
  {
    id: '1',
    applicationId: '1',
    type: 'bank_statement',
    status: 'processed',
    confidence: 0.95,
    url: 'https://storage.example.com/doc1.pdf'
  }
];

const mockWebhooks = [
  {
    id: '1',
    url: 'https://api.client.com/webhook',
    events: ['application.created', 'application.updated'],
    active: true
  }
];

const mockUsers = [
  {
    email: 'admin@dollarfunding.com',
    password: 'hashedPassword123', // In real impl this would be properly hashed
    role: 'admin'
  }
];

// Auth Handlers
export const authHandlers: RequestHandler[] = [
  // Login handler
  rest.post(`${API_ENDPOINTS.AUTH}/login`, async (req, res, ctx) => {
    const { email, password } = await req.json();
    const user = mockUsers.find(u => u.email === email && u.password === password);

    if (!user) {
      return res(
        ctx.delay(100),
        ctx.status(HTTP_STATUS.UNAUTHORIZED),
        ctx.json({
          error: 'Invalid credentials',
          code: 'ERR_AUTH'
        })
      );
    }

    return res(
      ctx.delay(200),
      ctx.status(HTTP_STATUS.OK),
      ctx.json({
        token: 'mock.jwt.token',
        user: { email: user.email, role: user.role }
      })
    );
  }),

  // MFA verification handler
  rest.post(`${API_ENDPOINTS.AUTH}/mfa/verify`, async (req, res, ctx) => {
    const { code } = await req.json();
    
    return res(
      ctx.delay(150),
      ctx.status(code === '123456' ? HTTP_STATUS.OK : HTTP_STATUS.BAD_REQUEST),
      ctx.json(code === '123456' ? { verified: true } : { error: 'Invalid code' })
    );
  })
];

// Application Handlers
export const applicationHandlers: RequestHandler[] = [
  // Get applications list
  rest.get(API_ENDPOINTS.APPLICATIONS, (req, res, ctx) => {
    const page = Number(req.url.searchParams.get('page')) || 1;
    const limit = Number(req.url.searchParams.get('limit')) || 10;
    const status = req.url.searchParams.get('status');

    let filteredApps = [...mockApplications];
    if (status) {
      filteredApps = filteredApps.filter(app => app.status === status);
    }

    const start = (page - 1) * limit;
    const paginatedApps = filteredApps.slice(start, start + limit);

    return res(
      ctx.delay(300),
      ctx.status(HTTP_STATUS.OK),
      ctx.json({
        data: paginatedApps,
        meta: {
          page,
          limit,
          total: filteredApps.length
        }
      })
    );
  }),

  // Get application detail
  rest.get(`${API_ENDPOINTS.APPLICATIONS}/:id`, (req, res, ctx) => {
    const { id } = req.params;
    const application = mockApplications.find(app => app.id === id);

    if (!application) {
      return res(
        ctx.delay(200),
        ctx.status(HTTP_STATUS.NOT_FOUND),
        ctx.json({ error: 'Application not found' })
      );
    }

    return res(
      ctx.delay(200),
      ctx.status(HTTP_STATUS.OK),
      ctx.json({ data: application })
    );
  })
];

// Document Handlers
export const documentHandlers: RequestHandler[] = [
  // Upload document
  rest.post(API_ENDPOINTS.DOCUMENTS, async (req, res, ctx) => {
    const formData = await req.formData();
    const file = formData.get('file');
    const applicationId = formData.get('applicationId');

    if (!file || !applicationId) {
      return res(
        ctx.status(HTTP_STATUS.BAD_REQUEST),
        ctx.json({ error: 'Missing required fields' })
      );
    }

    const newDocument = {
      id: String(mockDocuments.length + 1),
      applicationId: String(applicationId),
      type: 'bank_statement',
      status: 'processing',
      confidence: null,
      url: 'https://storage.example.com/temp.pdf'
    };

    mockDocuments.push(newDocument);

    return res(
      ctx.delay(500),
      ctx.status(HTTP_STATUS.CREATED),
      ctx.json({ data: newDocument })
    );
  }),

  // Get documents for application
  rest.get(`${API_ENDPOINTS.DOCUMENTS}`, (req, res, ctx) => {
    const applicationId = req.url.searchParams.get('applicationId');
    
    if (!applicationId) {
      return res(
        ctx.status(HTTP_STATUS.BAD_REQUEST),
        ctx.json({ error: 'Application ID required' })
      );
    }

    const documents = mockDocuments.filter(doc => doc.applicationId === applicationId);

    return res(
      ctx.delay(200),
      ctx.status(HTTP_STATUS.OK),
      ctx.json({ data: documents })
    );
  })
];

// Webhook Handlers
export const webhookHandlers: RequestHandler[] = [
  // Get webhooks
  rest.get(API_ENDPOINTS.WEBHOOKS, (req, res, ctx) => {
    return res(
      ctx.delay(200),
      ctx.status(HTTP_STATUS.OK),
      ctx.json({ data: mockWebhooks })
    );
  }),

  // Create webhook
  rest.post(API_ENDPOINTS.WEBHOOKS, async (req, res, ctx) => {
    const webhook = await req.json();

    if (!webhook.url || !webhook.events?.length) {
      return res(
        ctx.status(HTTP_STATUS.BAD_REQUEST),
        ctx.json({ error: 'Invalid webhook configuration' })
      );
    }

    const newWebhook = {
      id: String(mockWebhooks.length + 1),
      ...webhook,
      active: true
    };

    mockWebhooks.push(newWebhook);

    return res(
      ctx.delay(300),
      ctx.status(HTTP_STATUS.CREATED),
      ctx.json({ data: newWebhook })
    );
  }),

  // Test webhook
  rest.post(`${API_ENDPOINTS.WEBHOOKS}/:id/test`, (req, res, ctx) => {
    const { id } = req.params;
    const webhook = mockWebhooks.find(w => w.id === id);

    if (!webhook) {
      return res(
        ctx.status(HTTP_STATUS.NOT_FOUND),
        ctx.json({ error: 'Webhook not found' })
      );
    }

    return res(
      ctx.delay(500),
      ctx.status(HTTP_STATUS.OK),
      ctx.json({
        data: {
          success: true,
          statusCode: 200,
          latency: 123
        }
      })
    );
  })
];

// Export all handlers combined
export const handlers = [
  ...authHandlers,
  ...applicationHandlers,
  ...documentHandlers,
  ...webhookHandlers
];