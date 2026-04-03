# Dockerfile for Card Benefits Railway Deployment
# Multi-stage build for optimal image size and performance

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:18-alpine AS deps

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Prune dev dependencies
RUN npm prune --omit=optional --omit=dev

# ============================================
# Stage 2: Builder
# ============================================
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# ============================================
# Stage 3: Runtime
# ============================================
FROM node:18-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy production dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy prisma schema and migrations
COPY --from=builder /app/prisma ./prisma

# Copy built application from builder stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./

# Copy build info
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/tsconfig.json ./

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check for Railway
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start the application
CMD ["npm", "start"]

# ============================================
# Build metadata
# ============================================
LABEL org.opencontainers.image.title="Card Benefits"
LABEL org.opencontainers.image.description="Track credit card benefits and maximize rewards"
LABEL org.opencontainers.image.vendor="Card Benefits Team"
LABEL org.opencontainers.image.version="1.0.0"

# ============================================
# Notes
# ============================================
# 
# Building:
# docker build -t card-benefits:latest .
# 
# Running locally:
# docker run -p 3000:3000 \
#   -e DATABASE_URL="postgresql://..." \
#   -e SESSION_SECRET="..." \
#   -e CRON_SECRET="..." \
#   -e NODE_ENV=production \
#   card-benefits:latest
# 
# Railway automatically:
# - Builds from this Dockerfile if present
# - Sets port from PORT environment variable (default 3000)
# - Manages networking and HTTPS
# - Handles secrets via Railway dashboard
#
# Optimization Notes:
# - Multi-stage build reduces final image size from ~500MB to ~200MB
# - Alpine base image minimizes security surface
# - Non-root user improves security
# - Layer caching optimized (dependencies change less than code)
