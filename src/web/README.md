# AI-Driven Application Intake Platform - Web Frontend

## Overview

Enterprise-grade React application for processing and managing merchant cash advance applications with real-time document processing visualization, secure authentication, and comprehensive data management capabilities.

### Key Features
- Real-time application dashboard with document processing status
- High-performance document viewer with data extraction overlay
- Interactive processing queue management
- Dynamic webhook configuration interface
- Enterprise-grade security and authentication
- WCAG 2.1 Level AA accessibility compliance

## Technical Requirements

### Prerequisites
- Node.js >=18.0.0
- npm >=9.0.0
- Git
- Docker (optional for containerized development)

### Supported Browsers
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Getting Started

### Installation
```bash
# Clone the repository
git clone [repository-url]
cd src/web

# Install dependencies
npm install
```

### Environment Setup
1. Copy `.env.example` to `.env`
2. Configure required environment variables:
   - `VITE_API_BASE_URL`: Backend API endpoint
   - `VITE_AUTH_DOMAIN`: Authentication domain
   - `VITE_STORAGE_URL`: Document storage URL
   - `VITE_WEBSOCKET_URL`: WebSocket endpoint

### Development Scripts
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test

# Run linting
npm run lint

# Run E2E tests
npm run e2e
```

## Project Structure

```
src/
├── components/          # Reusable UI components
├── pages/              # Route-based page components
├── services/           # API clients and integrations
├── store/              # Redux store configuration
├── utils/              # Helper functions
├── hooks/              # Custom React hooks
├── contexts/           # React context providers
├── interfaces/         # TypeScript definitions
└── assets/            # Static resources

tests/
├── unit/              # Jest unit tests
├── integration/       # Integration tests
├── e2e/              # Cypress E2E tests
└── mocks/            # Test mocks
```

## Development Guidelines

### Component Development
- Use TypeScript for all new components
- Follow functional component patterns with hooks
- Implement prop validation using TypeScript interfaces
- Include unit tests with React Testing Library
- Document component props and usage

### State Management
- Use Redux for global application state
- Implement Redux Toolkit for state slices
- Use React Context for theme/auth state
- Follow flux architecture patterns

### API Integration
- Use RTK Query for API calls
- Implement proper error handling
- Add request/response type definitions
- Include retry logic for failed requests
- Cache responses appropriately

### Accessibility Implementation
- Follow WCAG 2.1 Level AA standards
- Implement proper ARIA labels and roles
- Ensure keyboard navigation support
- Test with screen readers
- Support high contrast mode
- Maintain focus management
- Implement error announcements

## Testing Strategy

### Unit Testing
- Jest + React Testing Library
- Test component rendering
- Test user interactions
- Test state changes
- Maintain >80% coverage

### Integration Testing
- Test API integrations
- Test component interactions
- Test state management
- Test route transitions

### E2E Testing
- Cypress for critical user flows
- Test main application features
- Test error scenarios
- Test accessibility compliance

## Build and Deployment

### Production Build
```bash
# Create optimized build
npm run build

# Preview production build
npm run preview
```

### Docker Support
```bash
# Build container
docker build -t ai-intake-web .

# Run container
docker run -p 3000:80 ai-intake-web
```

### CI/CD Integration
- GitHub Actions workflow included
- Automated testing on PR
- Production deployment pipeline
- Performance monitoring setup
- Error tracking integration

## Performance Optimization

### Implemented Optimizations
- Code splitting by route
- Lazy loading of components
- Image optimization
- Cache management
- Bundle size optimization
- Performance monitoring
- Lighthouse score maintenance

## Security Considerations

### Security Measures
- Secure authentication flow
- XSS prevention
- CSRF protection
- Content Security Policy
- Secure HTTP headers
- Regular dependency updates
- Security scanning integration

## Monitoring and Analytics

### Monitoring Setup
- Error tracking with Sentry
- Performance monitoring
- User analytics
- API call tracking
- Console error tracking
- Performance metrics collection

## Contributing

### Development Workflow
1. Create feature branch
2. Implement changes
3. Add tests
4. Update documentation
5. Submit pull request
6. Pass CI checks
7. Code review
8. Merge to main

### Code Style
- Follow ESLint configuration
- Use Prettier for formatting
- Follow component naming conventions
- Maintain file structure
- Document complex logic
- Use TypeScript strictly

## License

Proprietary - All rights reserved

## Support

Contact development team for support:
- Email: dev-support@dollarfunding.com
- Slack: #ai-intake-support