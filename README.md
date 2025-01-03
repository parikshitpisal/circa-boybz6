# AI-Driven Application Intake Platform

[![Build Status](https://github.com/dollarfunding/application-intake/workflows/CI/badge.svg)](https://github.com/dollarfunding/application-intake/actions)
[![Coverage](https://codecov.io/gh/dollarfunding/application-intake/branch/main/graph/badge.svg)](https://codecov.io/gh/dollarfunding/application-intake)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Enterprise-grade document processing system for high-volume MCA application processing, featuring advanced OCR with 95%+ accuracy and processing capacity of 1000+ daily applications.

## Overview

The AI-Driven Application Intake Platform is a comprehensive solution for automating Merchant Cash Advance (MCA) application processing. Key features include:

- Real-time document processing with advanced OCR (95%+ accuracy)
- High-volume capacity (1000+ applications daily)
- Automated email monitoring and attachment processing
- Secure document storage with encryption at rest and in transit
- Seamless CRM system integration
- Role-based access control (RBAC)
- Comprehensive audit logging and compliance tracking

## Architecture

The platform implements a modern, cloud-native architecture:

```mermaid
graph TD
    A[Email Service] -->|SMTP/IMAP| B[Message Queue]
    B -->|RabbitMQ| C[Document Processor]
    C -->|REST API| D[API Gateway]
    D -->|GraphQL/REST| E[Web Interface]
    C -->|S3 API| F[Document Storage]
    D -->|SQL| G[Database]
    D -->|Redis| H[Cache]
```

Key architectural components:
- Microservices architecture with Docker containerization
- Event-driven processing using RabbitMQ
- Multi-region cloud deployment with auto-scaling
- Load-balanced API gateway with rate limiting
- Distributed caching using Redis
- PostgreSQL database with read replicas
- S3-compatible encrypted document storage
- Automated CI/CD pipeline with GitHub Actions

## Technology Stack

### Backend Services
- Node.js 18 LTS (API Gateway)
- Python 3.11+ (Document Processing)
- PostgreSQL 15+ with PostGIS
- Redis 7+ (Caching Layer)

### Frontend
- React 18+ with TypeScript
- Material-UI v5
- Apollo GraphQL Client

### Infrastructure
- Docker 24+ (Containerization)
- Kubernetes 1.26+ (Orchestration)
- AWS Services Suite
- Terraform (IaC)

## Getting Started

### Prerequisites
```bash
# Required software versions
node >= 18.0.0
python >= 3.11.0
docker >= 24.0.0
kubectl >= 1.26.0
```

### Local Development Setup
```bash
# Clone repository
git clone https://github.com/dollarfunding/application-intake.git
cd application-intake

# Install dependencies
npm install
python -m pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Start development services
docker-compose up -d

# Initialize database
npm run db:migrate

# Start development server
npm run dev
```

### Environment Configuration
```bash
# Required environment variables
API_PORT=3000
NODE_ENV=development
DB_CONNECTION=postgresql://user:pass@localhost:5432/appdb
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://localhost:5672
AWS_REGION=us-east-1
S3_BUCKET=document-storage
```

## Deployment

### Production Deployment
```bash
# Build containers
docker build -t app-intake-api ./api
docker build -t app-intake-processor ./processor

# Deploy to Kubernetes
kubectl apply -f k8s/

# Verify deployment
kubectl get pods -n application-intake
```

### Infrastructure Setup
```bash
# Initialize Terraform
cd terraform
terraform init

# Plan deployment
terraform plan -out=tfplan

# Apply infrastructure
terraform apply tfplan
```

## Monitoring

The platform includes comprehensive monitoring:

- Prometheus metrics collection
- Grafana dashboards
- ELK stack for log aggregation
- Custom alerting rules
- Performance metrics tracking

## Security

Refer to [SECURITY.md](SECURITY.md) for:
- Security policies
- Vulnerability reporting
- Compliance requirements
- Data protection measures

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Development workflow
- Code standards
- Pull request process
- Testing requirements

## API Reference

API documentation is available at:
- Development: http://localhost:3000/api/docs
- Production: https://api.intake.dollarfunding.com/docs

## Troubleshooting

Common issues and solutions:

### Email Processing
```bash
# Check email service logs
kubectl logs -f deployment/email-service -n application-intake

# Verify IMAP connectivity
nc -zv imap.dollarfunding.com 993
```

### Document Processing
```bash
# Monitor processing queue
rabbitmqctl list_queues

# Check processor logs
kubectl logs -f deployment/document-processor -n application-intake
```

## Performance

Performance benchmarks and optimization:

- Document processing: < 5 minutes per application
- API response time: < 100ms (95th percentile)
- Queue processing: 1000+ documents per hour
- Storage throughput: 100MB/s read/write

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- Email: support@dollarfunding.com
- Slack: #application-intake
- Documentation: https://docs.intake.dollarfunding.com