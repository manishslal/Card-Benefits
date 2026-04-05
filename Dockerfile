# ============================================================================
# Production-Grade Dockerfile for Card Benefits Tracker
# Multi-stage build: smaller image, faster deployment, improved security
# ============================================================================

# ───────────────────────────────────────────────────────────────────────────
# Stage 1: Dependencies
# ───────────────────────────────────────────────────────────────────────────
FROM node:18-alpine AS dependencies

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with npm ci (cleaner, faster, more reliable than npm install)
RUN npm ci --only=production && \
    npm cache clean --force

# ───────────────────────────────────────────────────────────────────────────
# Stage 2: Build
# ───────────────────────────────────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client (required before build)
RUN npm run db:generate

# Build Next.js application
# NEXT_TELEMETRY_DISABLED: Disable Next.js telemetry in production
RUN NEXT_TELEMETRY_DISABLED=1 npm run build

# ───────────────────────────────────────────────────────────────────────────
# Stage 3: Runtime
# ───────────────────────────────────────────────────────────────────────────
FROM node:18-alpine AS runtime

# Install dumb-init to handle signals properly in containers
RUN apk add --no-cache dumb-init

WORKDIR /app

# Create non-root user for security (principle of least privilege)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy production dependencies from dependencies stage
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/package*.json ./

# Copy built application from builder stage
COPY --from=builder /app/.next ./.next
# Only copy prisma if it exists (needed for migrations)
COPY --from=builder /app/prisma ./prisma

# Generate Prisma client in runtime (required for app to run)
RUN npm run db:generate

# Note: .env.example is for development reference only, not needed in production image

# Change ownership to non-root user
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check: Verify application is responsive
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Use dumb-init to properly handle signals (SIGTERM for graceful shutdown)
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "-e", "require('next/dist/bin/next').nextStart()"]
