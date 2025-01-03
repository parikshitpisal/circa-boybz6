# Stage 1: Builder
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ git curl

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json lerna.json ./
COPY services/*/package*.json ./services/
COPY shared/package*.json ./shared/

# Install dependencies
RUN npm ci

# Copy source code and config files
COPY tsconfig.json .
COPY services ./services
COPY shared ./shared

# Build TypeScript services
RUN npm run build:prod

# Run tests and linting
RUN npm run test:ci && \
    npm run lint && \
    npm run format:check

# Stage 2: Python Document Processor
FROM python:3.11-slim AS processor

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    tesseract-ocr \
    libtesseract-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy Python requirements and install
COPY services/document-processor/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy built Python service
COPY --from=builder /app/dist/services/document-processor ./

# Stage 3: Production Node.js
FROM node:18-alpine AS production

# Install production dependencies
RUN apk add --no-cache curl tini

# Create non-root user
RUN addgroup -g 1001 nodeapp && \
    adduser -u 1001 -G nodeapp -s /bin/sh -D nodeapp

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=processor /app ./document-processor

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    PROCESSOR_PORT=8000 \
    LOG_LEVEL=info \
    GRACEFUL_SHUTDOWN_TIMEOUT=30

# Set up volumes
VOLUME ["/app/tmp", "/app/logs"]

# Configure health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:$PORT/health || exit 1

# Set resource limits
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Set proper ownership and permissions
RUN chown -R nodeapp:nodeapp /app && \
    chmod -R 755 /app && \
    chmod -R 644 /app/dist && \
    chmod 755 /app/dist/services/*/bin/* && \
    chmod -R 777 /app/tmp /app/logs

# Switch to non-root user
USER nodeapp

# Expose ports
EXPOSE 3000 8000

# Add container metadata
LABEL maintainer="Dollar Funding DevOps Team" \
    version="1.0.0" \
    description="Dollar Funding Backend Services" \
    build-date="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
    vcs-url="git@github.com:dollarfunding/application-intake.git" \
    vendor="Dollar Funding"

# Use tini as init process
ENTRYPOINT ["/sbin/tini", "--"]

# Start services
CMD ["node", "dist/services/api-gateway/src/index.js"]