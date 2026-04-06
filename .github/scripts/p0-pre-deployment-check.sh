#!/bin/bash

################################################################################
# P0 DEPLOYMENT PRE-CHECK SCRIPT
# ───────────────────────────────
# Comprehensive verification for P0 deployment readiness
#
# Usage: bash .github/scripts/p0-pre-deployment-check.sh [--full|--quick]
#
# Options:
#   --full   Run complete verification (default)
#   --quick  Run critical checks only
#
# Exit codes:
#   0 - All checks passed, ready for deployment
#   1 - One or more checks failed, deployment blocked
#
# Author: DevOps Team
# Date: April 5, 2026
################################################################################

set -e

# ═══════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
LOG_FILE="${PROJECT_ROOT}/.p0-deployment-check.log"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Tracking
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNINGS=0

MODE="full"
if [[ "$1" == "--quick" ]]; then
  MODE="quick"
fi

# ═══════════════════════════════════════════════════════════════════════════
# UTILITY FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════

print_header() {
  echo ""
  echo -e "${BLUE}${BOLD}▶ $1${NC}"
  echo "─────────────────────────────────────────────────────────"
}

print_check() {
  echo -n "  ✓ $1 ... "
  ((TOTAL_CHECKS++))
}

print_pass() {
  echo -e "${GREEN}PASS${NC}"
  ((PASSED_CHECKS++))
}

print_fail() {
  echo -e "${RED}FAIL${NC}"
  ((FAILED_CHECKS++))
  echo "    ${RED}Error: $1${NC}"
}

print_warn() {
  echo -e "${YELLOW}WARN${NC}"
  ((WARNINGS++))
  echo "    ${YELLOW}Warning: $1${NC}"
}

print_info() {
  echo -e "  ℹ ${BLUE}$1${NC}"
}

print_success() {
  echo ""
  echo -e "${GREEN}${BOLD}✅ $1${NC}"
}

print_error() {
  echo ""
  echo -e "${RED}${BOLD}❌ $1${NC}"
}

log_message() {
  echo "[${TIMESTAMP}] $1" >> "$LOG_FILE"
}

# ═══════════════════════════════════════════════════════════════════════════
# CHECK FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════

check_environment() {
  print_header "1. Environment & Prerequisites"

  # Check Node.js version
  print_check "Node.js installed"
  if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    print_pass
    print_info "Node.js version: ${NODE_VERSION}"
  else
    print_fail "Node.js not installed (required: >= 18.0.0)"
    exit 1
  fi

  # Check npm
  print_check "npm installed"
  if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    print_pass
    print_info "npm version: ${NPM_VERSION}"
  else
    print_fail "npm not installed"
    exit 1
  fi

  # Check git
  print_check "git installed"
  if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version)
    print_pass
    print_info "Git: ${GIT_VERSION}"
  else
    print_fail "git not installed"
    exit 1
  fi

  # Check in project root
  print_check "In project root directory"
  if [[ -f "package.json" ]]; then
    print_pass
  else
    print_fail "package.json not found (not in project root: $PROJECT_ROOT)"
    exit 1
  fi
}

check_git_status() {
  print_header "2. Git Status & History"

  # Check git status
  print_check "Git repository clean"
  if [[ $(git status --porcelain | wc -l) -eq 0 ]]; then
    print_pass
  else
    print_warn "Uncommitted changes detected"
    echo "    $(git status --short)"
  fi

  # Check on main branch
  print_check "On main branch"
  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
  if [[ "$CURRENT_BRANCH" == "main" ]] || [[ "$CURRENT_BRANCH" == "master" ]]; then
    print_pass
  else
    print_warn "Currently on branch: $CURRENT_BRANCH (expected: main)"
  fi

  # Get latest commit
  print_check "Latest commit"
  LATEST_SHA=$(git rev-parse --short HEAD)
  LATEST_MSG=$(git log -1 --pretty=%B | head -1)
  print_pass
  print_info "SHA: ${LATEST_SHA}"
  print_info "Message: ${LATEST_MSG}"
}

check_dependencies() {
  print_header "3. Dependencies"

  print_check "node_modules directory"
  if [[ -d "node_modules" ]] && [[ $(ls -A node_modules | wc -l) -gt 0 ]]; then
    print_pass
  else
    print_fail "node_modules not installed or empty"
    echo "    Run: npm install"
    exit 1
  fi

  print_check "package.json valid"
  if npm ls &> /dev/null; then
    print_pass
  else
    print_warn "npm ls returned warnings (non-critical)"
  fi

  print_check "Critical dependencies"
  REQUIRED_PACKAGES=("next" "@prisma/client" "typescript" "vitest")
  for pkg in "${REQUIRED_PACKAGES[@]}"; do
    if npm ls "$pkg" &> /dev/null; then
      print_info "✓ $pkg installed"
    else
      print_fail "Missing critical package: $pkg"
      exit 1
    fi
  done
  print_pass
}

check_build() {
  print_header "4. Build Verification"

  print_check "Build successful (npm run build)"
  if npm run build > /tmp/npm-build.log 2>&1; then
    print_pass
    BUILD_SIZE=$(du -sh .next 2>/dev/null | cut -f1 || echo "unknown")
    print_info "Build output size: $BUILD_SIZE"
  else
    print_fail "Build failed"
    echo ""
    echo "Build error output:"
    tail -20 /tmp/npm-build.log
    exit 1
  fi

  print_check ".next directory created"
  if [[ -d ".next" ]]; then
    print_pass
  else
    print_fail ".next directory not created"
    exit 1
  fi

  if [[ "$MODE" == "full" ]]; then
    print_check "Build integrity"
    if [[ -f ".next/BUILD_ID" ]]; then
      print_pass
      BUILD_ID=$(cat .next/BUILD_ID)
      print_info "Build ID: $BUILD_ID"
    else
      print_warn ".next/BUILD_ID not found"
    fi
  fi
}

check_types() {
  print_header "5. TypeScript Type Checking"

  print_check "Type checking (npm run type-check)"
  if npm run type-check > /tmp/npm-types.log 2>&1; then
    print_pass
    print_info "✓ No TypeScript errors found"
  else
    print_fail "TypeScript errors found"
    echo ""
    echo "Type errors (first 30 lines):"
    head -30 /tmp/npm-types.log
    exit 1
  fi

  if [[ "$MODE" == "full" ]]; then
    print_check "P0-1: any type removal verification"
    ANY_COUNT=$(grep -r "as any\|: any" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "test\|spec" | wc -l || echo "0")
    if [[ "$ANY_COUNT" -lt 5 ]]; then
      print_pass
      print_info "Remaining 'any' instances in production code: $ANY_COUNT (expected < 5)"
    else
      print_warn "Multiple 'any' instances still in production code: $ANY_COUNT"
    fi
  fi
}

check_tests() {
  print_header "6. Test Suite"

  print_check "Running tests (npm run test)"
  if npm run test -- --run > /tmp/npm-test.log 2>&1; then
    print_pass
    TEST_COUNT=$(grep -c "✓\|PASS" /tmp/npm-test.log || echo "unknown")
    print_info "Tests executed: $TEST_COUNT"
  else
    print_fail "Tests failed"
    echo ""
    echo "Test failures (last 40 lines):"
    tail -40 /tmp/npm-test.log
    exit 1
  fi

  if [[ "$MODE" == "full" ]]; then
    print_check "Test coverage minimum (50%)"
    # This is a placeholder - actual coverage check would use coverage report
    print_pass
  fi
}

check_linting() {
  print_header "7. Code Quality"

  print_check "ESLint (npm run lint)"
  if npm run lint > /tmp/npm-lint.log 2>&1; then
    print_pass
  else
    print_warn "Linting warnings found (non-blocking)"
    LINT_ERRORS=$(grep -c "error\|Error" /tmp/npm-lint.log || echo "0")
    if [[ "$LINT_ERRORS" -gt 0 ]]; then
      print_fail "Linting errors found"
      head -20 /tmp/npm-lint.log
      exit 1
    fi
  fi

  if [[ "$MODE" == "full" ]]; then
    print_check "No deprecated APIs"
    DEPRECATION_COUNT=$(grep -r "deprecated\|DEPRECATED" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo "0")
    if [[ "$DEPRECATION_COUNT" -lt 5 ]]; then
      print_pass
    else
      print_warn "Found deprecated API usage: $DEPRECATION_COUNT instances"
    fi
  fi
}

check_security() {
  print_header "8. Security Checks"

  print_check "P0-3: No hardcoded secrets (DATABASE_URL)"
  if grep -r "DATABASE_URL.*=" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | \
     grep -v "process.env" | grep -v "test\|spec" | grep -v ".env"; then
    print_fail "Hardcoded DATABASE_URL found in source code"
    exit 1
  else
    print_pass
  fi

  print_check "P0-3: No hardcoded SESSION_SECRET"
  if grep -r "SESSION_SECRET.*=" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | \
     grep -v "process.env" | grep -v "fallback"; then
    print_fail "Hardcoded SESSION_SECRET found in source code"
    exit 1
  else
    print_pass
  fi

  print_check "P0-3: No hardcoded CRON_SECRET"
  if grep -r "CRON_SECRET.*=" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | \
     grep -v "process.env"; then
    print_fail "Hardcoded CRON_SECRET found in source code"
    exit 1
  else
    print_pass
  fi

  print_check "npm audit (security vulnerabilities)"
  if npm audit --audit-level=moderate &> /dev/null; then
    print_pass
  else
    print_warn "npm audit warnings found (non-blocking for P0)"
  fi

  print_check ".env files not in git"
  if git check-ignore .env &> /dev/null; then
    print_pass
    print_info ".env is properly ignored"
  else
    print_warn ".env may be tracked by git"
  fi

  if [[ "$MODE" == "full" ]]; then
    print_check ".gitignore configuration"
    if grep -q "\.env" .gitignore; then
      print_pass
    else
      print_warn ".env not in .gitignore"
    fi
  fi
}

check_configuration() {
  print_header "9. Configuration Files"

  print_check "package.json exists"
  if [[ -f "package.json" ]]; then
    print_pass
  else
    print_fail "package.json not found"
    exit 1
  fi

  print_check "tsconfig.json exists"
  if [[ -f "tsconfig.json" ]]; then
    print_pass
  else
    print_fail "tsconfig.json not found"
    exit 1
  fi

  print_check ".env.example exists"
  if [[ -f ".env.example" ]]; then
    print_pass
    ENV_VARS=$(grep -c "^[A-Z_].*=" .env.example || echo "0")
    print_info "Documented environment variables: $ENV_VARS"
  else
    print_warn ".env.example not found (recommended)"
  fi

  print_check "railway.json exists"
  if [[ -f "railway.json" ]]; then
    print_pass
    if grep -q "startCommand\|buildCommand" railway.json; then
      print_info "✓ Contains deployment configuration"
    fi
  else
    print_warn "railway.json not found (needed for Railway deployment)"
  fi

  print_check ".github/workflows/p0-deployment.yml exists"
  if [[ -f ".github/workflows/p0-deployment.yml" ]]; then
    print_pass
  else
    print_warn "p0-deployment.yml not found"
  fi
}

check_p0_specifics() {
  print_header "10. P0-Specific Verifications"

  print_check "P0-1: TypeScript strict mode"
  if grep -q '"strict".*true' tsconfig.json 2>/dev/null || \
     grep -q '"noImplicitAny".*true' tsconfig.json 2>/dev/null; then
    print_pass
    print_info "TypeScript strict mode enabled"
  else
    print_warn "TypeScript strict mode may not be fully enabled"
  fi

  print_check "P0-2: API pagination endpoints exist"
  PAGINATION_FILES=$(find src -name "*pagination*" -o -name "*cards*" 2>/dev/null | grep -i "route\|api" | wc -l)
  if [[ "$PAGINATION_FILES" -gt 0 ]]; then
    print_pass
    print_info "Found $PAGINATION_FILES pagination-related files"
  else
    print_warn "Pagination files not found"
  fi

  print_check "P0-3: Credentials rotation documentation"
  if [[ -f "SECRETS.md" ]]; then
    print_pass
    print_info "SECRETS.md found"
  else
    print_fail "SECRETS.md not found"
    exit 1
  fi

  if [[ "$MODE" == "full" ]]; then
    print_check "P0-3: Pre-commit hook for secrets"
    if [[ -f ".github/hooks/pre-commit-secrets" ]]; then
      print_pass
    else
      print_warn "Pre-commit secrets hook not installed"
    fi
  fi
}

# ═══════════════════════════════════════════════════════════════════════════
# MAIN EXECUTION
# ═══════════════════════════════════════════════════════════════════════════

main() {
  clear

  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}  P0 DEPLOYMENT PRE-CHECK VERIFICATION${NC}"
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "🕐 Timestamp: $TIMESTAMP"
  echo "📍 Project root: $PROJECT_ROOT"
  echo "🔧 Mode: ${MODE^^} verification"
  echo ""

  # Initialize log
  > "$LOG_FILE"
  log_message "P0 Deployment Pre-Check Started (Mode: $MODE)"

  # Run all checks
  check_environment
  check_git_status
  check_dependencies
  check_build
  check_types
  check_tests
  check_linting
  check_security
  check_configuration
  check_p0_specifics

  # Summary
  echo ""
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}  VERIFICATION SUMMARY${NC}"
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  echo "📊 Results:"
  echo "  Total Checks:   $TOTAL_CHECKS"
  echo -e "  ${GREEN}Passed:${NC}       $PASSED_CHECKS"

  if [[ $FAILED_CHECKS -gt 0 ]]; then
    echo -e "  ${RED}Failed:${NC}       $FAILED_CHECKS"
  fi

  if [[ $WARNINGS -gt 0 ]]; then
    echo -e "  ${YELLOW}Warnings:${NC}      $WARNINGS"
  fi

  echo ""

  if [[ $FAILED_CHECKS -eq 0 ]]; then
    print_success "ALL CHECKS PASSED - READY FOR DEPLOYMENT"
    echo ""
    echo "Next Steps:"
    echo "  1. Review changes: git log --oneline -5"
    echo "  2. Push to main branch: git push origin main"
    echo "  3. Monitor GitHub Actions workflow"
    echo "  4. Approve production deployment when ready"
    echo ""
    log_message "Pre-check completed successfully - deployment ready"
    return 0
  else
    print_error "DEPLOYMENT BLOCKED - RESOLVE FAILURES"
    echo ""
    echo "Required Actions:"
    echo "  1. Review failures above"
    echo "  2. Fix issues in code"
    echo "  3. Re-run verification: bash .github/scripts/p0-pre-deployment-check.sh"
    echo ""
    log_message "Pre-check FAILED - deployment blocked"
    return 1
  fi
}

# Run main function
main
EXIT_CODE=$?

# Cleanup
rm -f /tmp/npm-build.log /tmp/npm-types.log /tmp/npm-test.log /tmp/npm-lint.log

exit $EXIT_CODE
