# ---- Build stage ----
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

# Build args for Vite environment variables
ARG VITE_API_URL=http://localhost:4001
ARG VITE_KEYCLOAK_URL=http://localhost:8080
ARG VITE_KEYCLOAK_REALM=backr
ARG VITE_KEYCLOAK_CLIENT_ID=backr-web
ARG VITE_ENVIRONMENT_NAME=Local
ARG VITE_SITE_VARIANT=A
ARG VITE_SENTRY_DSN=

# Set as env vars for build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL
ENV VITE_KEYCLOAK_REALM=$VITE_KEYCLOAK_REALM
ENV VITE_KEYCLOAK_CLIENT_ID=$VITE_KEYCLOAK_CLIENT_ID
ENV VITE_ENVIRONMENT_NAME=$VITE_ENVIRONMENT_NAME
ENV VITE_SITE_VARIANT=$VITE_SITE_VARIANT
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN

# Copy workspace root files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/ packages/shared/
COPY apps/web/ apps/web/

# Build shared package
RUN pnpm --filter @backr/shared build

# Build web app
RUN pnpm --filter @backr/web build

# ---- Production stage ----
FROM nginx:1.27-alpine AS production

# Security: run as non-root
RUN addgroup -g 1001 -S nginx-app && \
    adduser -S nginx-app -u 1001 -G nginx-app && \
    chown -R nginx-app:nginx-app /var/cache/nginx && \
    chown -R nginx-app:nginx-app /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx-app:nginx-app /var/run/nginx.pid

# Copy nginx config
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

EXPOSE 80

USER nginx-app

CMD ["nginx", "-g", "daemon off;"]
