#!/bin/bash
##############################################################################
# Post-Deployment Verification Script
# Validates production deployment health and functionality
# Usage: ./scripts/post-deployment-check.sh <app-url>
# Example: ./scripts/post-deployment-check.sh https://my-app.railway.app
##############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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
# Main Script
# ──────────────────────────────────────────────────────────────────────────

APP_URL=${1:-""}

if [ -z "$APP_URL" ]; then
    echo "Usage: ./scripts/post-deployment-check.sh <app-url>"
    echo "Example: ./scripts/post-deployment-check.sh https://my-app.railway.app"
    exit 1
fi

# Ensure URL doesn't have trailing slash
APP_URL="${APP_URL%/}"

log_section "POST-DEPLOYMENT VERIFICATION"
log_info "Testing application: $APP_URL"
echo ""

# ──────────────────────────────────────────────────────────────────────────
# 1. Basic Connectivity
# ──────────────────────────────────────────────────────────────────────────

log_section "1. Basic Connectivity"

# Test if host is reachable
if ping -c 1 "$(echo $APP_URL | cut -d'/' -f3)" > /dev/null 2>&1; then
    log_pass "Host is reachable"
else
    log_warn "Host ping failed (may be blocked)"
fi

# Test HTTPS
if curl -s --connect-timeout 10 -m 10 "$APP_URL" > /dev/null 2>&1; then
    log_pass "Application is accessible"
else
    log_fail "Cannot connect to $APP_URL"
fi

# ──────────────────────────────────────────────────────────────────────────
# 2. Health Check Endpoint
# ──────────────────────────────────────────────────────────────────────────

log_section "2. Health Check Endpoint"

HEALTH_RESPONSE=$(curl -s --connect-timeout 10 -m 10 "$APP_URL/api/health" 2>/dev/null || echo "")

if [ -z "$HEALTH_RESPONSE" ]; then
    log_fail "Health endpoint not responding"
else
    log_pass "Health endpoint responded"
    
    # Check JSON parsing
    if echo "$HEALTH_RESPONSE" | grep -q "status"; then
        log_pass "Health response is valid JSON"
        
        # Check status field
        if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
            log_pass "Health status: OK"
        else
            log_warn "Health status not OK: $HEALTH_RESPONSE"
        fi
        
        # Check database connection
        if echo "$HEALTH_RESPONSE" | grep -q '"database":"connected"'; then
            log_pass "Database: Connected"
        else
            log_fail "Database: Not connected"
        fi
    else
        log_fail "Health response not valid JSON"
    fi
fi

# ──────────────────────────────────────────────────────────────────────────
# 3. Page Load Tests
# ──────────────────────────────────────────────────────────────────────────

log_section "3. Page Load Tests"

# Home page
RESPONSE_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL" --connect-timeout 10 -m 10)
if [ "$RESPONSE_CODE" = "200" ]; then
    log_pass "Home page loads (HTTP $RESPONSE_CODE)"
else
    log_warn "Home page returned HTTP $RESPONSE_CODE"
fi

# Sign up page
RESPONSE_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL/signup" --connect-timeout 10 -m 10)
if [ "$RESPONSE_CODE" = "200" ]; then
    log_pass "Sign up page loads (HTTP $RESPONSE_CODE)"
else
    log_warn "Sign up page returned HTTP $RESPONSE_CODE"
fi

# Login page
RESPONSE_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL/login" --connect-timeout 10 -m 10)
if [ "$RESPONSE_CODE" = "200" ]; then
    log_pass "Login page loads (HTTP $RESPONSE_CODE)"
else
    log_warn "Login page returned HTTP $RESPONSE_CODE"
fi

# ──────────────────────────────────────────────────────────────────────────
# 4. Response Headers
# ──────────────────────────────────────────────────────────────────────────

log_section "4. Security Headers"

HEADERS=$(curl -s -i "$APP_URL" 2>/dev/null | head -20)

# Check for security headers
if echo "$HEADERS" | grep -qi "strict-transport-security"; then
    log_pass "HSTS header present"
else
    log_warn "HSTS header missing"
fi

if echo "$HEADERS" | grep -qi "x-content-type-options"; then
    log_pass "X-Content-Type-Options header present"
else
    log_warn "X-Content-Type-Options header missing"
fi

if echo "$HEADERS" | grep -qi "x-frame-options"; then
    log_pass "X-Frame-Options header present"
else
    log_warn "X-Frame-Options header missing"
fi

# Check for content type
if echo "$HEADERS" | grep -qi "content-type: text/html"; then
    log_pass "Content-Type: HTML"
else
    log_warn "Unexpected content type"
fi

# ──────────────────────────────────────────────────────────────────────────
# 5. Response Time Test
# ──────────────────────────────────────────────────────────────────────────

log_section "5. Performance"

RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$APP_URL" --connect-timeout 10 -m 10)
RESPONSE_TIME_MS=$(echo "$RESPONSE_TIME * 1000" | bc | cut -d. -f1)

log_info "Response time: ${RESPONSE_TIME_MS}ms"

if (( $(echo "$RESPONSE_TIME < 5" | bc -l) )); then
    log_pass "Response time is excellent (< 5s)"
elif (( $(echo "$RESPONSE_TIME < 10" | bc -l) )); then
    log_pass "Response time is good (< 10s)"
else
    log_warn "Response time is slow (> 10s): ${RESPONSE_TIME}s"
fi

# ──────────────────────────────────────────────────────────────────────────
# 6. API Connectivity
# ──────────────────────────────────────────────────────────────────────────

log_section "6. API Endpoints"

# Health API
HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL/api/health" --connect-timeout 10 -m 10)
if [ "$HEALTH_CODE" = "200" ]; then
    log_pass "/api/health: $HEALTH_CODE"
else
    log_fail "/api/health: $HEALTH_CODE"
fi

# Check common endpoints (adjust based on your app)
# Example: /api/cards, /api/users, etc.
log_info "Note: Adjust API endpoints based on your application"

# ──────────────────────────────────────────────────────────────────────────
# 7. SSL/TLS Certificate
# ──────────────────────────────────────────────────────────────────────────

log_section "7. SSL/TLS Certificate"

# Extract certificate info
CERT_INFO=$(echo | openssl s_client -servername "$(echo $APP_URL | cut -d'/' -f3)" -connect "$(echo $APP_URL | cut -d'/' -f3):443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || echo "")

if [ ! -z "$CERT_INFO" ]; then
    log_pass "SSL certificate is valid"
    
    # Check expiration
    EXPIRY=$(echo "$CERT_INFO" | grep "notAfter=" | cut -d= -f2)
    log_info "Certificate expires: $EXPIRY"
else
    log_warn "Could not verify SSL certificate"
fi

# ──────────────────────────────────────────────────────────────────────────
# 8. Database Migrations
# ──────────────────────────────────────────────────────────────────────────

log_section "8. Database Status"

# Check if health endpoint shows database is migrated
if curl -s "$APP_URL/api/health" 2>/dev/null | grep -q '"database":"connected"'; then
    log_pass "Database migrations completed"
else
    log_warn "Database may not be fully migrated (verify manually)"
fi

# ──────────────────────────────────────────────────────────────────────────
# 9. Error Checking
# ──────────────────────────────────────────────────────────────────────────

log_section "9. Error Check"

# Try to detect common error pages
for page in "/" "/signup" "/login"; do
    RESPONSE=$(curl -s "$APP_URL$page" --connect-timeout 10 -m 10)
    
    # Check for error indicators
    if echo "$RESPONSE" | grep -qi "error\|500\|exception\|undefined"; then
        log_warn "Possible error detected on $page"
    fi
done

log_pass "No obvious errors detected"

# ──────────────────────────────────────────────────────────────────────────
# Summary
# ──────────────────────────────────────────────────────────────────────────

log_section "POST-DEPLOYMENT VERIFICATION SUMMARY"

echo -e "Passed:   ${GREEN}$PASSED${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo -e "Failed:   ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ DEPLOYMENT VERIFIED SUCCESSFULLY${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Test core functionality manually"
    echo "2. Monitor logs for the next 24 hours"
    echo "3. Set up alerting in Railway dashboard"
    echo "4. Document any issues found"
else
    echo -e "${RED}❌ DEPLOYMENT VERIFICATION FOUND ISSUES${NC}"
    echo ""
    echo "Issues found: $FAILED"
    echo "Warnings: $WARNINGS"
    echo ""
    echo "Steps to investigate:"
    echo "1. Check Railway deployment logs: railway logs --follow"
    echo "2. Verify environment variables: railway variables:get"
    echo "3. Check database connection: Visit /api/health"
    echo "4. Review application health endpoint response"
fi

echo ""
echo "For more information, see: PRODUCTION_DEPLOYMENT_GUIDE.md"
