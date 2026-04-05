#!/bin/bash
##############################################################################
# Pre-Deployment Verification Script
# Validates all requirements before production deployment
# Usage: ./scripts/pre-deployment-check.sh
##############################################################################

set -e  # Exit on first error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# ──────────────────────────────────────────────────────────────────────────
# Helper Functions
# ──────────────────────────────────────────────────────────────────────────

log_pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
    ((PASSED++))
}

log_fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    ((FAILED++))
}

log_warn() {
    echo -e "${YELLOW}⚠️  WARN${NC}: $1"
    ((WARNINGS++))
}

log_info() {
    echo -e "${BLUE}ℹ️  INFO${NC}: $1"
}

log_section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# ──────────────────────────────────────────────────────────────────────────
# 1. Environment & Dependencies
# ──────────────────────────────────────────────────────────────────────────

log_section "1. Environment & Dependencies"

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    if [[ $NODE_VERSION == v18* ]] || [[ $NODE_VERSION == v20* ]]; then
        log_pass "Node.js version: $NODE_VERSION"
    else
        log_warn "Node.js version $NODE_VERSION (recommended: v18 or v20)"
    fi
else
    log_fail "Node.js not found"
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    log_pass "npm version: $NPM_VERSION"
else
    log_fail "npm not found"
fi

# Check node_modules
if [ -d "node_modules" ]; then
    log_pass "Dependencies installed (node_modules found)"
else
    log_fail "Dependencies not installed - run 'npm ci'"
fi

# ──────────────────────────────────────────────────────────────────────────
# 2. Code Quality
# ──────────────────────────────────────────────────────────────────────────

log_section "2. Code Quality Checks"

# ESLint
if npm run lint > /dev/null 2>&1; then
    log_pass "ESLint: No linting errors"
else
    log_warn "ESLint: Some warnings detected (review manually)"
fi

# Type checking
if npm run type-check > /dev/null 2>&1; then
    log_pass "Type checking: No TypeScript errors"
else
    log_fail "Type checking: TypeScript compilation errors found"
fi

# ──────────────────────────────────────────────────────────────────────────
# 3. Build Verification
# ──────────────────────────────────────────────────────────────────────────

log_section "3. Build Verification"

# Generate Prisma client
if npm run db:generate > /dev/null 2>&1; then
    log_pass "Prisma schema: Generated successfully"
else
    log_fail "Prisma schema: Generation failed"
fi

# Build application
if NEXT_TELEMETRY_DISABLED=1 npm run build > /dev/null 2>&1; then
    log_pass "Build: Next.js application built successfully"
else
    log_fail "Build: Next.js build failed - fix errors before deploying"
fi

# Verify build artifact
if [ -d ".next" ]; then
    BUILD_SIZE=$(du -sh .next | cut -f1)
    log_pass "Build artifact: .next directory exists ($BUILD_SIZE)"
else
    log_fail "Build artifact: .next directory not found"
fi

# ──────────────────────────────────────────────────────────────────────────
# 4. Security Checks
# ──────────────────────────────────────────────────────────────────────────

log_section "4. Security Checks"

# Check for hardcoded secrets
SECRETS_FOUND=$(grep -r "password\|secret\|token\|api.key" src/ \
    --include="*.ts" --include="*.tsx" --include="*.js" \
    --exclude-dir=node_modules \
    2>/dev/null | grep -v "// SECRET\|process.env\|NEXT_PUBLIC" | wc -l)

if [ "$SECRETS_FOUND" -eq 0 ]; then
    log_pass "Secrets: No hardcoded secrets detected in source code"
else
    log_warn "Secrets: Found $SECRETS_FOUND potential hardcoded values (review manually)"
fi

# Check .env.local not committed
if ! git ls-files --error-unmatch .env.local > /dev/null 2>&1; then
    log_pass ".env.local: Not committed to repository ✓"
else
    log_fail ".env.local: Found in git - remove immediately with 'git rm --cached .env.local'"
fi

# Check .env files
if [ -f ".env.example" ]; then
    log_pass ".env.example: Template file exists"
else
    log_warn ".env.example: Not found - create as template for required variables"
fi

# Npm audit
log_info "Running npm audit..."
if npm audit --audit-level=moderate 2>&1 | grep -q "0 vulnerabilities"; then
    log_pass "Dependencies: No moderate/high vulnerabilities"
else
    log_warn "Dependencies: Security vulnerabilities detected (review: npm audit)"
fi

# ──────────────────────────────────────────────────────────────────────────
# 5. Environment Variables
# ──────────────────────────────────────────────────────────────────────────

log_section "5. Environment Variables"

# Required variables list
REQUIRED_VARS=("DATABASE_URL" "SESSION_SECRET" "CRON_SECRET")

for var in "${REQUIRED_VARS[@]}"; do
    if grep -q "^$var=" .env.example 2>/dev/null; then
        log_pass "Environment: $var documented in .env.example"
    else
        log_warn "Environment: $var not found in .env.example"
    fi
done

log_info "Before deployment, ensure these are set in Railway dashboard:"
for var in "${REQUIRED_VARS[@]}"; do
    echo "  - $var"
done

# ──────────────────────────────────────────────────────────────────────────
# 6. Database & Prisma
# ──────────────────────────────────────────────────────────────────────────

log_section "6. Database & Prisma"

# Check prisma/schema.prisma
if [ -f "prisma/schema.prisma" ]; then
    log_pass "Prisma schema: File exists"
    
    # Count models
    MODEL_COUNT=$(grep -c "^model " prisma/schema.prisma || echo "0")
    log_info "Prisma models defined: $MODEL_COUNT"
else
    log_fail "Prisma schema: Not found at prisma/schema.prisma"
fi

# Check Prisma client
if [ -d "node_modules/.prisma/client" ]; then
    log_pass "Prisma client: Generated"
else
    log_warn "Prisma client: Not generated (run: npm run db:generate)"
fi

# ──────────────────────────────────────────────────────────────────────────
# 7. Git Status
# ──────────────────────────────────────────────────────────────────────────

log_section "7. Git Status"

# Check for uncommitted changes
if [ -z "$(git status --porcelain)" ]; then
    log_pass "Git: Working directory clean"
else
    log_warn "Git: Uncommitted changes found (review before pushing)"
    git status --short | head -10
fi

# Get current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
log_info "Current branch: $CURRENT_BRANCH"

# Get latest commit
LATEST_COMMIT=$(git log -1 --oneline)
log_info "Latest commit: $LATEST_COMMIT"

# ──────────────────────────────────────────────────────────────────────────
# 8. Health Check Verification
# ──────────────────────────────────────────────────────────────────────────

log_section "8. Health Check & Endpoints"

# Check for health check endpoint
if grep -r "api/health" src/ --include="*.ts" --include="*.tsx" > /dev/null 2>&1; then
    log_pass "Health endpoint: /api/health implemented"
else
    log_warn "Health endpoint: /api/health not found (recommended for production)"
fi

# ──────────────────────────────────────────────────────────────────────────
# 9. Docker Verification (if Dockerfile exists)
# ──────────────────────────────────────────────────────────────────────────

log_section "9. Docker Verification"

if [ -f "Dockerfile" ]; then
    log_pass "Dockerfile: Found"
    
    if command -v docker &> /dev/null; then
        log_info "Docker available - you can test with: docker build -t app ."
    else
        log_info "Docker not available locally (but will work in CI/CD)"
    fi
else
    log_warn "Dockerfile: Not found (needed for container deployment)"
fi

if [ -f "docker-compose.yml" ]; then
    log_pass "docker-compose.yml: Found"
else
    log_warn "docker-compose.yml: Not found (helpful for local testing)"
fi

# ──────────────────────────────────────────────────────────────────────────
# 10. Railway Configuration
# ──────────────────────────────────────────────────────────────────────────

log_section "10. Railway Configuration"

if [ -f "railway.json" ]; then
    log_pass "railway.json: Configuration file found"
    
    # Verify key settings
    if grep -q "healthCheck" railway.json; then
        log_pass "railway.json: Health check configured"
    else
        log_warn "railway.json: No health check configured"
    fi
else
    log_warn "railway.json: Not found (needed for Railway deployment)"
fi

# ──────────────────────────────────────────────────────────────────────────
# Final Summary
# ──────────────────────────────────────────────────────────────────────────

log_section "DEPLOYMENT READINESS SUMMARY"

echo -e "Passed:   ${GREEN}$PASSED${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo -e "Failed:   ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ READY FOR DEPLOYMENT${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Ensure environment variables are set in Railway dashboard"
    echo "2. Merge changes to main branch"
    echo "3. GitHub Actions will automatically deploy"
    echo "4. Monitor deployment at: https://railway.app"
    echo "5. Verify health endpoint after deployment"
    exit 0
else
    echo -e "${RED}❌ NOT READY FOR DEPLOYMENT${NC}"
    echo ""
    echo "Fix the $FAILED error(s) above before deploying"
    exit 1
fi
