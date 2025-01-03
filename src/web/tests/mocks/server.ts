import { setupServer, SetupServer } from 'msw/node'; // v1.2.0
import { rest } from 'msw'; // v1.2.0

// Server configuration options
const SERVER_OPTIONS = {
  onUnhandledRequest: 'warn',
  networkDelay: 100,
};

// Mock API response handlers
const handlers = [
  // Applications endpoints
  rest.get('/api/v1/applications', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        applications: [
          {
            id: 'app-123',
            businessName: 'ABC Corp',
            status: 'complete',
            timestamp: new Date().toISOString(),
          },
          {
            id: 'app-456',
            businessName: 'XYZ LLC',
            status: 'processing',
            timestamp: new Date().toISOString(),
          },
        ],
      })
    );
  }),

  rest.get('/api/v1/applications/:id', (req, res, ctx) => {
    const { id } = req.params;
    return res(
      ctx.status(200),
      ctx.json({
        id,
        businessName: 'ABC Corp',
        status: 'complete',
        documents: [
          {
            id: 'doc-123',
            type: 'bank_statement',
            status: 'processed',
          },
        ],
      })
    );
  }),

  // Documents endpoints
  rest.get('/api/v1/documents/:id', (req, res, ctx) => {
    const { id } = req.params;
    return res(
      ctx.status(200),
      ctx.json({
        id,
        type: 'bank_statement',
        content: 'mock_document_content',
        extractedData: {
          businessName: 'ABC Corp',
          accountNumber: '****1234',
        },
      })
    );
  }),

  // Webhook endpoints
  rest.post('/api/v1/webhooks', (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        id: 'webhook-123',
        url: 'https://api.example.com/webhook',
        events: ['application.completed', 'document.processed'],
        status: 'active',
      })
    );
  }),

  // Error simulation handlers
  rest.get('/api/v1/error/unauthorized', (_, res, ctx) => {
    return res(
      ctx.status(401),
      ctx.json({
        error: 'Unauthorized access',
        code: 'AUTH_ERROR',
      })
    );
  }),

  rest.get('/api/v1/error/forbidden', (_, res, ctx) => {
    return res(
      ctx.status(403),
      ctx.json({
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
      })
    );
  }),

  rest.get('/api/v1/error/not-found', (_, res, ctx) => {
    return res(
      ctx.status(404),
      ctx.json({
        error: 'Resource not found',
        code: 'NOT_FOUND',
      })
    );
  }),

  rest.get('/api/v1/error/server-error', (_, res, ctx) => {
    return res(
      ctx.status(500),
      ctx.json({
        error: 'Internal server error',
        code: 'SERVER_ERROR',
      })
    );
  }),

  // Rate limiting simulation
  rest.get('/api/v1/error/rate-limit', (_, res, ctx) => {
    return res(
      ctx.status(429),
      ctx.set('Retry-After', '60'),
      ctx.json({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT',
        retryAfter: 60,
      })
    );
  }),
];

// Create and configure MSW server instance
const server = setupServer(...handlers);

// Configure response delay simulation
server.listen({
  onUnhandledRequest: SERVER_OPTIONS.onUnhandledRequest,
});

// Add response timing simulation
server.events.on('request:start', () => {
  return new Promise((resolve) => {
    setTimeout(resolve, SERVER_OPTIONS.networkDelay);
  });
});

// Add request logging in development
if (process.env.NODE_ENV === 'development') {
  server.events.on('request:start', ({ request }) => {
    console.log(`[MSW] ${request.method} ${request.url}`);
  });
}

// Export configured server instance
export { server };

// Export handler utilities for test-specific modifications
export const resetHandlers = () => server.resetHandlers();
export const addTestHandler = (handler: any) => server.use(handler);