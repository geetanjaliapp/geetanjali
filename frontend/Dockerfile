# Frontend Dockerfile for Geetanjali
#
# SEO pages are generated post-deployment via backend API and shared
# between containers using a Docker volume (seo_output).
# Backend writes to /app/seo-output, nginx reads from /usr/share/nginx/html/seo

# ==========================================
# Stage 1: Frontend Build
# ==========================================
FROM node:20-alpine AS builder

# Build args for Vite environment variables (baked into bundle)
ARG VITE_API_URL=http://localhost:8000
ARG VITE_API_V1_PREFIX=/api/v1
ARG VITE_SENTRY_DSN=
ARG VITE_UMAMI_WEBSITE_ID=

# Set working directory
WORKDIR /app

# Copy package files (context is repo root, so prefix with frontend/)
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source code
COPY frontend/ .

# Pass build args as environment variables for Vite
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_API_V1_PREFIX=$VITE_API_V1_PREFIX
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV VITE_UMAMI_WEBSITE_ID=$VITE_UMAMI_WEBSITE_ID

# Build the application
RUN npm run build

# Production stage - using nginx:alpine with non-root configuration
FROM nginx:alpine

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration (context is repo root)
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Create nginx user writable directories and fix permissions
# nginx:alpine has nginx user (UID 101, GID 101)
RUN chmod -R 755 /usr/share/nginx/html && \
    find /usr/share/nginx/html -type f -exec chmod 644 {} \; && \
    # Create SEO directory (overlaid by seo_output volume in docker-compose)
    mkdir -p /usr/share/nginx/html/seo && \
    # Create directories nginx needs to write to
    mkdir -p /var/cache/nginx/client_temp \
             /var/cache/nginx/proxy_temp \
             /var/cache/nginx/fastcgi_temp \
             /var/cache/nginx/uwsgi_temp \
             /var/cache/nginx/scgi_temp && \
    # Change ownership to nginx user
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/run && \
    chown -R nginx:nginx /var/log/nginx && \
    # Ensure nginx can read the config
    chmod 644 /etc/nginx/conf.d/default.conf && \
    # Touch the PID file location with correct permissions
    touch /var/run/nginx.pid && \
    chown nginx:nginx /var/run/nginx.pid

# Expose ports (80 for HTTP, 443 for HTTPS)
# Note: Binding to ports <1024 requires NET_BIND_SERVICE capability (set in docker-compose)
EXPOSE 80 443

# Switch to non-root user
USER nginx

# Health check - use dedicated endpoint that bypasses HTTPS redirect
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -q --spider http://localhost/nginx-health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
