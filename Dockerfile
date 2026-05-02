################################################################################
# Stage 1: deps — install all dependencies (dev + prod)
################################################################################
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --ignore-scripts


################################################################################
# Stage 2: builder — compile frontend (Vite) + bundle backend (esbuild)
################################################################################
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build frontend (dist/public) + backend (dist/index.cjs)
RUN npm run build


################################################################################
# Stage 3: runner — minimal production image
################################################################################
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install only prod dependencies for packages NOT bundled by esbuild
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy compiled output
COPY --from=builder /app/dist ./dist

# Copy DB migrations (needed for drizzle-kit push or migrate at startup)
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/server ./server

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health || exit 1

CMD ["node", "dist/index.cjs"]
