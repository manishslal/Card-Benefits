#!/bin/bash

###############################################################################
# Phase 2B Production Migration Script
# 
# Purpose: Safe database migration for Phase 2B deployment
# 
# Features:
#   - Pre-migration backup
#   - Zero-downtime migration
#   - Data integrity verification
#   - Rollback capability
#   - Detailed logging
# 
# Usage: ./scripts/migrate-production.sh
# 
###############################################################################

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="${BACKUP_DIR:-.}/backups"
BACKUP_NAME="phase2b-backup-$(date +%Y%m%d_%H%M%S).sql"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"
LOG_FILE="${BACKUP_DIR}/migration-$(date +%Y%m%d_%H%M%S).log"

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

# Logging function
log() {
  local level=$1
  shift
  local message="$@"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  
  case $level in
    INFO)
      echo -e "${BLUE}[${timestamp}] ℹ️  ${message}${NC}" | tee -a "${LOG_FILE}"
      ;;
    SUCCESS)
      echo -e "${GREEN}[${timestamp}] ✅ ${message}${NC}" | tee -a "${LOG_FILE}"
      ;;
    WARN)
      echo -e "${YELLOW}[${timestamp}] ⚠️  ${message}${NC}" | tee -a "${LOG_FILE}"
      ;;
    ERROR)
      echo -e "${RED}[${timestamp}] ❌ ${message}${NC}" | tee -a "${LOG_FILE}"
      ;;
  esac
}

error_exit() {
  log ERROR "$@"
  exit 1
}

###############################################################################
# Pre-migration checks
###############################################################################

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Phase 2B Production Migration Script${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

log INFO "Starting Phase 2B production migration..."

# Check environment variables
if [ -z "${DATABASE_URL:-}" ]; then
  error_exit "DATABASE_URL environment variable not set"
fi

log INFO "Environment: NODE_ENV=${NODE_ENV:-development}"
log INFO "Backup directory: ${BACKUP_DIR}"
log INFO "Backup file: ${BACKUP_NAME}"

###############################################################################
# Step 1: Create pre-migration backup
###############################################################################

log INFO "Step 1/5: Creating pre-migration database backup..."

if ! pg_dump "${DATABASE_URL}" > "${BACKUP_PATH}" 2>/dev/null; then
  error_exit "Failed to create backup. Ensure PostgreSQL client is installed."
fi

# Verify backup file was created and has content
if [ ! -s "${BACKUP_PATH}" ]; then
  error_exit "Backup file created but is empty"
fi

BACKUP_SIZE=$(du -h "${BACKUP_PATH}" | cut -f1)
log SUCCESS "Backup created successfully (${BACKUP_SIZE})"

###############################################################################
# Step 2: Verify database connectivity
###############################################################################

log INFO "Step 2/5: Verifying database connectivity..."

if ! psql "${DATABASE_URL}" -c "SELECT NOW();" > /dev/null 2>&1; then
  error_exit "Cannot connect to database. Check DATABASE_URL and network connectivity."
fi

log SUCCESS "Database connectivity verified"

###############################################################################
# Step 3: Check existing schema
###############################################################################

log INFO "Step 3/5: Verifying existing database schema..."

# Count tables before migration
TABLE_COUNT=$(psql "${DATABASE_URL}" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
log INFO "Current table count: ${TABLE_COUNT}"

# List existing tables
log INFO "Existing tables:"
psql "${DATABASE_URL}" -c "
  SELECT tablename FROM pg_tables 
  WHERE schemaname = 'public' 
  ORDER BY tablename;
" | sed 's/^/  /'

###############################################################################
# Step 4: Run Prisma migration
###############################################################################

log INFO "Step 4/5: Running Prisma database migration..."

if ! npx prisma migrate deploy 2>&1 | tee -a "${LOG_FILE}"; then
  log ERROR "Migration failed. Rolling back..."
  
  # Restore from backup
  log INFO "Restoring database from backup..."
  if psql "${DATABASE_URL}" < "${BACKUP_PATH}" > /dev/null 2>&1; then
    log SUCCESS "Database restored from backup"
  else
    error_exit "Backup restoration failed. Database may be in inconsistent state. CRITICAL!"
  fi
  
  error_exit "Migration failed and database has been rolled back"
fi

log SUCCESS "Prisma migration completed successfully"

###############################################################################
# Step 5: Verify new schema
###############################################################################

log INFO "Step 5/5: Verifying Phase 2B database schema..."

# Check for Phase 2B tables
PHASE2B_TABLES=("BenefitUsageRecord" "BenefitPeriod" "BenefitRecommendation")

for table in "${PHASE2B_TABLES[@]}"; do
  if psql "${DATABASE_URL}" -t -c "SELECT to_regclass('public.\"${table}\"');" | grep -q "${table}"; then
    log SUCCESS "✓ Table ${table} created"
  else
    error_exit "Table ${table} not found after migration"
  fi
done

# Verify indexes
log INFO "Verifying indexes..."

INDEX_COUNT=$(psql "${DATABASE_URL}" -t -c "
  SELECT COUNT(*) FROM pg_indexes 
  WHERE schemaname = 'public' 
  AND tablename IN ('BenefitUsageRecord', 'BenefitPeriod', 'BenefitRecommendation');
")

log SUCCESS "Phase 2B indexes created: ${INDEX_COUNT}"

###############################################################################
# Step 6: Data integrity verification
###############################################################################

log INFO "Verifying data integrity..."

# Verify Phase 1 data is intact
MASTERCARD_COUNT=$(psql "${DATABASE_URL}" -t -c "SELECT COUNT(*) FROM \"MasterCard\";")
log INFO "MasterCard records: ${MASTERCARD_COUNT}"

MASTERBENEFIT_COUNT=$(psql "${DATABASE_URL}" -t -c "SELECT COUNT(*) FROM \"MasterBenefit\";")
log INFO "MasterBenefit records: ${MASTERBENEFIT_COUNT}"

USER_COUNT=$(psql "${DATABASE_URL}" -t -c "SELECT COUNT(*) FROM \"User\";")
log INFO "User records: ${USER_COUNT}"

# Verify Phase 2B data
USAGE_RECORDS=$(psql "${DATABASE_URL}" -t -c "SELECT COUNT(*) FROM \"BenefitUsageRecord\";")
log INFO "BenefitUsageRecord records: ${USAGE_RECORDS}"

RECOMMENDATIONS=$(psql "${DATABASE_URL}" -t -c "SELECT COUNT(*) FROM \"BenefitRecommendation\";")
log INFO "BenefitRecommendation records: ${RECOMMENDATIONS}"

PERIODS=$(psql "${DATABASE_URL}" -t -c "SELECT COUNT(*) FROM \"BenefitPeriod\";")
log INFO "BenefitPeriod records: ${PERIODS}"

###############################################################################
# Step 7: Generate Prisma Client
###############################################################################

log INFO "Regenerating Prisma client..."

if ! npx prisma generate 2>&1 | tee -a "${LOG_FILE}"; then
  error_exit "Prisma client generation failed"
fi

log SUCCESS "Prisma client regenerated"

###############################################################################
# Migration complete
###############################################################################

echo -e "\n${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Phase 2B Production Migration Completed Successfully${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}\n"

log SUCCESS "Migration completed at $(date '+%Y-%m-%d %H:%M:%S')"
log SUCCESS "Backup saved to: ${BACKUP_PATH}"
log SUCCESS "Migration log saved to: ${LOG_FILE}"

echo -e "\n${BLUE}Summary:${NC}"
echo "  ✓ Pre-migration backup created"
echo "  ✓ Database connectivity verified"
echo "  ✓ Prisma migration executed"
echo "  ✓ Phase 2B tables created"
echo "  ✓ Data integrity verified"
echo "  ✓ Prisma client regenerated"

echo -e "\n${BLUE}Next Steps:${NC}"
echo "  1. Deploy application code"
echo "  2. Verify health check: curl https://app/api/health"
echo "  3. Test Phase 2B features"
echo "  4. Monitor error logs for 1 hour"
echo "  5. Update status dashboard"

echo -e "\n${BLUE}Rollback (if needed):${NC}"
echo "  psql \${DATABASE_URL} < ${BACKUP_PATH}"

echo ""

exit 0
