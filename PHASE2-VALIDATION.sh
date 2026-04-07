#!/bin/bash

echo "🚀 Phase 2 Implementation Validation Script"
echo "=========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0
WARNINGS=0

# Check Phase 2A: Database
echo "📊 Phase 2A: Database Validation"
echo "--------------------------------"

# Check Prisma schema
if grep -q "BenefitUsageRecord" prisma/schema.prisma && \
   grep -q "BenefitPeriod" prisma/schema.prisma && \
   grep -q "BenefitRecommendation" prisma/schema.prisma && \
   grep -q "UserOnboardingState" prisma/schema.prisma; then
    echo -e "${GREEN}✓${NC} All 4 new models present in schema"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Missing one or more Phase 2 models"
    ((FAILED++))
fi

# Check types file
if [ -f "src/features/benefits/types/benefits.ts" ]; then
    echo -e "${GREEN}✓${NC} Phase 2 types file exists"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Phase 2 types file missing"
    ((FAILED++))
fi

# Check Period Utils
if [ -f "src/features/benefits/lib/periodUtils.ts" ]; then
    echo -e "${GREEN}✓${NC} Period utilities exist"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Period utilities missing"
    ((FAILED++))
fi

# Check Benefit Usage Utils
if [ -f "src/features/benefits/lib/benefitUsageUtils.ts" ]; then
    echo -e "${GREEN}✓${NC} Benefit usage utilities exist"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Benefit usage utilities missing"
    ((FAILED++))
fi

# Check Filter Utils
if [ -f "src/features/benefits/lib/filterUtils.ts" ]; then
    echo -e "${GREEN}✓${NC} Filter utilities exist"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Filter utilities missing"
    ((FAILED++))
fi

echo ""
echo "🔧 Phase 2B: API Routes Validation"
echo "----------------------------------"

API_ROUTES=(
    "src/app/api/benefits/usage/record/route.ts"
    "src/app/api/benefits/[benefitId]/usage/route.ts"
    "src/app/api/benefits/[benefitId]/progress/route.ts"
    "src/app/api/benefits/user/progress/all/route.ts"
    "src/app/api/benefits/user/filtered/route.ts"
    "src/app/api/recommendations/route.ts"
    "src/app/api/recommendations/generate/route.ts"
    "src/app/api/recommendations/[id]/dismiss/route.ts"
    "src/app/api/onboarding/start/route.ts"
    "src/app/api/onboarding/state/route.ts"
    "src/app/api/onboarding/step/[step]/complete/route.ts"
    "src/app/api/onboarding/reset/route.ts"
)

MISSING_ROUTES=0
for route in "${API_ROUTES[@]}"; do
    if [ -f "$route" ]; then
        echo -e "${GREEN}✓${NC} $route"
        ((PASSED++))
    else
        echo -e "${YELLOW}○${NC} $route (pending)"
        ((WARNINGS++))
    fi
done

echo ""
echo "⚛️  Phase 2C-D: Custom Hooks Validation"
echo "-------------------------------------"

HOOKS=(
    "src/features/benefits/hooks/useBenefitUsage.ts"
    "src/features/benefits/hooks/useBenefitProgress.ts"
    "src/features/benefits/hooks/useBenefitFilters.ts"
    "src/features/benefits/hooks/useRecommendations.ts"
    "src/features/benefits/hooks/useOnboarding.ts"
    "src/features/benefits/hooks/useOfflineStatus.ts"
)

for hook in "${HOOKS[@]}"; do
    if [ -f "$hook" ]; then
        echo -e "${GREEN}✓${NC} $(basename $hook)"
        ((PASSED++))
    else
        echo -e "${YELLOW}○${NC} $(basename $hook) (pending)"
        ((WARNINGS++))
    fi
done

echo ""
echo "🧩 Phase 2C-E: Components Validation"
echo "-----------------------------------"

COMPONENT_DIRS=(
    "src/features/benefits/components/usage"
    "src/features/benefits/components/progress"
    "src/features/benefits/components/filters"
    "src/features/benefits/components/recommendations"
    "src/features/benefits/components/onboarding"
    "src/features/benefits/components/mobile"
)

for dir in "${COMPONENT_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        count=$(find "$dir" -name "*.tsx" | wc -l)
        echo -e "${GREEN}✓${NC} $(basename $dir): $count components"
        ((PASSED++))
    else
        echo -e "${YELLOW}○${NC} $(basename $dir) (pending)"
        ((WARNINGS++))
    fi
done

echo ""
echo "🧪 Testing Validation"
echo "-------------------"

if [ -f "src/features/benefits/__tests__/periodUtils.test.ts" ]; then
    echo -e "${GREEN}✓${NC} Period utilities tests exist"
    ((PASSED++))
else
    echo -e "${YELLOW}○${NC} Period utilities tests (pending)"
    ((WARNINGS++))
fi

if [ -f "src/features/benefits/__tests__/benefitUsageUtils.test.ts" ]; then
    echo -e "${GREEN}✓${NC} Benefit usage tests exist"
    ((PASSED++))
else
    echo -e "${YELLOW}○${NC} Benefit usage tests (pending)"
    ((WARNINGS++))
fi

echo ""
echo "📱 Phase 2F: Service Worker Validation"
echo "-------------------------------------"

if [ -f "public/service-worker.js" ]; then
    echo -e "${GREEN}✓${NC} Service worker exists"
    ((PASSED++))
else
    echo -e "${YELLOW}○${NC} Service worker (pending)"
    ((WARNINGS++))
fi

echo ""
echo "=========================================="
echo "Summary:"
echo -e "${GREEN}✓ Completed: $PASSED${NC}"
echo -e "${YELLOW}⚠ Pending: $WARNINGS${NC}"
echo -e "${RED}✗ Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}🎉 All Phase 2 components are ready!${NC}"
        exit 0
    else
        echo -e "${YELLOW}⚠️  Phase 2 is partially implemented. Continue with pending items.${NC}"
        exit 0
    fi
else
    echo -e "${RED}❌ Phase 2 validation failed. Check missing files above.${NC}"
    exit 1
fi
