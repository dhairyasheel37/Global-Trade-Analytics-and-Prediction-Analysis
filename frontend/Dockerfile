# ==========================================
# Stage 1: Build React Production Bundle
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Configure build argument for API base URL (defaults to /api for reverse proxy)
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Install node dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and build production distribution
COPY . .
RUN npm run build

# ==========================================
# Stage 2: Ultra-lightweight Nginx Runtime
# ==========================================
FROM nginx:1.27-alpine-slim AS runner

# Clean default assets
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled static distribution from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom reverse proxy and SPA Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose HTTP port
EXPOSE 80

# Healthcheck verifying Nginx responsiveness
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost/health || exit 1

# Launch Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
