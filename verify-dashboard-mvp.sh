#!/bin/bash

# Dashboard MVP Verification Script
# Checks that all files have been created correctly

echo "🔍 Dashboard MVP Verification Script"
echo "======================================"
echo ""

ERRORS=0
WARNINGS=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_file() {
  local file=$1
  local description=$2
  
  if [ -f "$file" ]; then
    echo -e "${GREEN}✅${NC} $description"
    echo "   Location: $file"
  else
    echo -e "${RED}❌${NC} $description NOT FOUND"
    echo "   Expected: $file"
    ERRORS=$((ERRORS + 1))
  fi
}

check_dir() {
  local dir=$1
  local description=$2
  
  if [ -d "$dir" ]; then
    echo -e "${GREEN}✅${NC} $description"
    echo "   Location: $dir"
  else
    echo -e "${RED}❌${NC} $description NOT FOUND"
    echo "   Expected: $dir"
    ERRORS=$((ERRORS + 1))
  fi
}

# Check Components
echo "📦 Checking Components..."
echo "------------------------"
check_file "src/app/dashboard/components/PeriodSelector.tsx" "PeriodSelector component"
check_file "src/app/dashboard/components/StatusFilters.tsx" "StatusFilters component"
check_file "src/app/dashboard/components/SummaryBox.tsx" "SummaryBox component"
check_file "src/app/dashboard/components/BenefitRow.tsx" "BenefitRow component"
check_file "src/app/dashboard/components/BenefitGroup.tsx" "BenefitGroup component"
check_file "src/app/dashboard/components/BenefitsList.tsx" "BenefitsList component"
check_file "src/app/dashboard/components/PastPeriodsSection.tsx" "PastPeriodsSection component"
check_file "src/app/dashboard/components/index.ts" "Components index file"
echo ""

# Check Tests
echo "🧪 Checking Tests..."
echo "-------------------"
check_dir "src/app/dashboard/components/__tests__" "Tests directory"
check_file "src/app/dashboard/components/__tests__/PeriodSelector.test.tsx" "PeriodSelector test"
echo ""

# Check Utilities
echo "🔧 Checking Utilities..."
echo "----------------------"
check_dir "src/app/dashboard/utils" "Utils directory"
check_file "src/app/dashboard/utils/period-helpers.ts" "Period helpers utility"
check_file "src/app/dashboard/utils/api-client.ts" "API client utility"
echo ""

# Check Pages
echo "📄 Checking Pages..."
echo "-------------------"
check_file "src/app/dashboard/new-page.tsx" "New enhanced dashboard page"
check_file "src/app/dashboard/page.tsx" "Original dashboard page (backup)"
echo ""

# Check Documentation
echo "📚 Checking Documentation..."
echo "---------------------------"
check_file "src/app/dashboard/README.md" "Dashboard README"
check_file "DASHBOARD_MVP_IMPLEMENTATION.md" "Implementation guide"
check_file "DASHBOARD_MVP_QUICKSTART.md" "Quick start guide"
check_file "DASHBOARD_MVP_DELIVERY_SUMMARY.md" "Delivery summary"
echo ""

# Summary
echo "======================================"
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✅ All files verified successfully!${NC}"
  echo ""
  echo "📊 Summary:"
  echo "  - 7 components created"
  echo "  - 2 utility modules created"
  echo "  - 1 enhanced dashboard page"
  echo "  - 1 test example"
  echo "  - 4 documentation files"
  echo ""
  echo "🚀 Next Steps:"
  echo "  1. Run: npm run dev"
  echo "  2. Open: http://localhost:3000/dashboard/new-page"
  echo "  3. Test the dashboard features"
  echo ""
  echo "📖 Read the documentation:"
  echo "  - DASHBOARD_MVP_QUICKSTART.md (5-minute setup)"
  echo "  - src/app/dashboard/README.md (component reference)"
  echo "  - DASHBOARD_MVP_IMPLEMENTATION.md (full guide)"
  exit 0
else
  echo -e "${RED}❌ $ERRORS file(s) missing${NC}"
  echo ""
  echo "Please ensure all files are created before proceeding."
  exit 1
fi
