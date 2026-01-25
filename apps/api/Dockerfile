# ---- Build stage ----
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

# Copy workspace root files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/ packages/shared/
COPY apps/api/ apps/api/

# Build shared package
RUN pnpm --filter @backr/shared build

# Generate Prisma client
RUN pnpm --filter @backr/api db:generate

# Build API
RUN pnpm --filter @backr/api build

# ---- Production stage ----
FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

COPY --from=builder /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/package.json ./
COPY --from=builder /app/apps/api/package.json apps/api/
COPY --from=builder /app/packages/shared/package.json packages/shared/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/apps/api/prisma apps/api/prisma

ENV NODE_ENV=production
EXPOSE 4001

CMD ["node", "apps/api/dist/server.js"]
