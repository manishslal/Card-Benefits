#!/usr/bin/env node

/**
 * Database Connection Validator
 *
 * Prevents accidental migrations/resets on production database
 * from local development machines.
 *
 * Run this before any database operations:
 *   node scripts/validate-db-connection.js
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL not set');
  process.exit(1);
}

// PRODUCTION database identifiers
const PRODUCTION_IDENTIFIERS = [
  'junction.proxy.rlwy.net', // Railway production
  'prod-',
  'production',
  'railway', // Generic Railway identifier
];

// SAFE identifiers (can be modified from local)
const SAFE_IDENTIFIERS = [
  'localhost',
  '127.0.0.1',
  'local',
  'dev',
];

console.log('🔐 Database Connection Validator');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Check if this is production database
const isProduction = PRODUCTION_IDENTIFIERS.some(id =>
  DATABASE_URL.toLowerCase().includes(id)
);

const isSafe = SAFE_IDENTIFIERS.some(id =>
  DATABASE_URL.toLowerCase().includes(id)
);

console.log(`📍 Database: ${DATABASE_URL.split('@')[1]?.split('/')[0] || 'Unknown'}`);
console.log(`🏷️  Environment: ${isProduction ? '🔴 PRODUCTION' : isSafe ? '🟢 LOCAL' : '🟡 UNKNOWN'}`);

if (isProduction && !process.env.ALLOW_PROD_MIGRATION) {
  console.error(`
❌ DANGER: Attempting database operation on PRODUCTION database!

This operation could:
  • Delete all user data
  • Destroy production database
  • Cause data loss

✋ BLOCKED - This is not allowed from local development.

If you really need to run migrations on production:
  1. Use CI/CD pipeline: git push → GitHub Actions → Railway
  2. OR run from Railway dashboard directly
  3. OR set ALLOW_PROD_MIGRATION=true (⚠️  DANGEROUS)

Commands you likely meant:
  • Local dev:  npm run db:reset  (creates local SQLite)
  • Production: Use Railway deployment pipeline
  `);
  process.exit(1);
}

console.log('✅ Connection validated - Safe to proceed\n');
process.exit(0);
