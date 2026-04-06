#!/bin/bash

# Phase 3: Validation Script
# Verifies all files are created and ready

echo "=== Phase 3 Admin Dashboard - File Validation ==="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
TOTAL=0
FOUND=0

# Function to check file
check_file() {
  local path="$1"
  local desc="$2"
  
  TOTAL=$((TOTAL + 1))
  
  if [ -f "$path" ]; then
    size=$(du -h "$path" | cut -f1)
    echo -e "${GREEN}✓${NC} $desc ($size)"
    FOUND=$((FOUND + 1))
  else
    echo -e "${RED}✗${NC} $desc"
  fi
}

# Function to check directory
check_dir() {
  local path="$1"
  local desc="$2"
  
  TOTAL=$((TOTAL + 1))
  
  if [ -d "$path" ]; then
    echo -e "${GREEN}✓${NC} $desc"
    FOUND=$((FOUND + 1))
  else
    echo -e "${RED}✗${NC} $desc"
  fi
}

# Check styles
echo "=== Styles ==="
check_file "src/features/admin/styles/design-tokens.css" "Design tokens"
check_file "src/features/admin/styles/admin.css" "Admin styles"
echo ""

# Check types
echo "=== Types ==="
check_dir "src/features/admin/types" "Types directory"
check_file "src/features/admin/types/admin.ts" "Admin types"
check_file "src/features/admin/types/api.ts" "API types"
check_file "src/features/admin/types/forms.ts" "Form types"
check_file "src/features/admin/types/index.ts" "Types index"
echo ""

# Check context
echo "=== Context ==="
check_dir "src/features/admin/context" "Context directory"
check_file "src/features/admin/context/AdminContext.tsx" "Admin context"
check_file "src/features/admin/context/UIContext.tsx" "UI context"
check_file "src/features/admin/context/index.ts" "Context index"
echo ""

# Check hooks
echo "=== Hooks ==="
check_dir "src/features/admin/hooks" "Hooks directory"
check_file "src/features/admin/hooks/useData.ts" "Data hooks"
check_file "src/features/admin/hooks/useUI.ts" "UI hooks"
check_file "src/features/admin/hooks/index.ts" "Hooks index"
echo ""

# Check lib
echo "=== Libraries ==="
check_dir "src/features/admin/lib" "Lib directory"
check_file "src/features/admin/lib/api-client.ts" "API client"
check_file "src/features/admin/lib/validators.ts" "Validators"
check_file "src/features/admin/lib/formatting.ts" "Formatting"
check_file "src/features/admin/lib/index.ts" "Lib index"
echo ""

# Check components
echo "=== Components ==="
check_dir "src/features/admin/components" "Components directory"
check_dir "src/features/admin/components/layout" "Layout components"
check_file "src/features/admin/components/layout/Layout.tsx" "Layout component"
check_file "src/features/admin/components/layout/index.ts" "Layout index"
echo ""
check_dir "src/features/admin/components/data-display" "Data display components"
check_file "src/features/admin/components/data-display/DataDisplay.tsx" "Data display component"
check_file "src/features/admin/components/data-display/index.ts" "Data display index"
echo ""
check_dir "src/features/admin/components/forms" "Form components"
check_file "src/features/admin/components/forms/Forms.tsx" "Forms component"
check_file "src/features/admin/components/forms/index.ts" "Forms index"
echo ""
check_dir "src/features/admin/components/notifications" "Notification components"
check_file "src/features/admin/components/notifications/Notifications.tsx" "Notifications component"
check_file "src/features/admin/components/notifications/index.ts" "Notifications index"
echo ""
check_file "src/features/admin/components/index.ts" "Components main index"
echo ""

# Check admin feature index
echo "=== Feature Index ==="
check_file "src/features/admin/index.ts" "Admin feature index"
echo ""

# Check documentation
echo "=== Documentation ==="
check_file "src/features/admin/README.md" "README"
check_file "PHASE3-DELIVERY-SUMMARY.md" "Delivery summary"
check_file "PHASE3-QUICK-START.md" "Quick start guide"
check_file "PHASE3-FILES-CREATED.md" "Files manifest"
echo ""

# Summary
echo "=== Validation Summary ==="
PERCENTAGE=$((FOUND * 100 / TOTAL))
echo "Files created: $FOUND / $TOTAL ($PERCENTAGE%)"
echo ""

if [ $FOUND -eq $TOTAL ]; then
  echo -e "${GREEN}✓ All files created successfully!${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Review src/features/admin/README.md"
  echo "2. Review PHASE3-QUICK-START.md"
  echo "3. Import components in your pages"
  echo "4. Test the admin dashboard"
  echo "5. Deploy to production"
  exit 0
else
  MISSING=$((TOTAL - FOUND))
  echo -e "${RED}✗ Missing $MISSING files${NC}"
  exit 1
fi
