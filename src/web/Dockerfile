# Stage 1: Build environment
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Add package management files
COPY package.json yarn.lock ./

# Set environment variables
ENV NODE_ENV=production \
    VITE_NODE_ENV=production \
    YARN_CACHE_FOLDER=/tmp/.yarn-cache

# Install dependencies with security audit
RUN yarn config set network-timeout 300000 && \
    yarn install --frozen-lockfile --production=false && \
    yarn audit && \
    # Clean yarn cache
    yarn cache clean

# Copy source files
COPY . .

# Build production bundle with optimizations
RUN yarn build && \
    # Compress static assets
    find dist -type f -regex '.*\.\(js\|css\|html\|svg\)$' -exec gzip -k {} \; && \
    find dist -type f -regex '.*\.\(js\|css\|html\|svg\)$' -exec brotli -k {} \;

# Stage 2: Production environment
FROM nginx:1.25-alpine

# Create nginx user/group with minimal privileges
RUN addgroup -g 101 -S nginx && \
    adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Set correct permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid && \
    # Remove unnecessary tools
    rm -rf /usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Configure security headers
RUN echo "add_header X-Frame-Options 'DENY' always;" >> /etc/nginx/conf.d/security.conf && \
    echo "add_header X-Content-Type-Options 'nosniff' always;" >> /etc/nginx/conf.d/security.conf && \
    echo "add_header X-XSS-Protection '1; mode=block' always;" >> /etc/nginx/conf.d/security.conf && \
    echo "add_header Strict-Transport-Security 'max-age=31536000; includeSubDomains' always;" >> /etc/nginx/conf.d/security.conf && \
    echo "add_header Content-Security-Policy \"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';\" always;" >> /etc/nginx/conf.d/security.conf

# Configure compression
RUN echo "gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;" >> /etc/nginx/conf.d/compression.conf && \
    echo "gzip_comp_level 6;" >> /etc/nginx/conf.d/compression.conf && \
    echo "gzip_min_length 1000;" >> /etc/nginx/conf.d/compression.conf

# Expose port
EXPOSE 80

# Set environment variables
ENV NGINX_WORKER_PROCESSES=auto \
    NGINX_WORKER_CONNECTIONS=1024

# Configure volumes
VOLUME ["/var/cache/nginx", "/var/run"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl --fail http://localhost:80/health || exit 1

# Switch to non-root user
USER nginx

# Start nginx
CMD ["nginx", "-g", "daemon off;"]