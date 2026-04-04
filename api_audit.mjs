import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

console.log("\n" + "=".repeat(100));
console.log("API & DATABASE INTEGRATION AUDIT REPORT");
console.log("=".repeat(100));

let users = [], userCards = [], userBenefits = [], sessions = [];

try {
  users = await prisma.user.findMany();
  userCards = await prisma.userCard.findMany({ include: { masterCard: true, userBenefits: true } });
  userBenefits = await prisma.userBenefit.findMany();
  sessions = await prisma.session.findMany();

  console.log("\n[PART 1: DATABASE CONTENTS]");
  console.log("-".repeat(100));

  console.log(`\nUSERS: ${users.length} user(s)`);
  users.forEach((u, i) => {
    console.log(`  ${i+1}. ${u.email} (ID: ${u.id.substring(0,8)}...)`);
  });

  console.log(`\nUSER CARDS: ${userCards.length} card(s)`);
  userCards.forEach((card, i) => {
    console.log(`  ${i+1}. ${card.masterCard?.cardName} (Status: ${card.status})`);
    console.log(`     - Annual Fee: $${card.actualAnnualFee / 100}`);
    console.log(`     - Benefits: ${card.userBenefits?.length || 0}`);
  });

  console.log(`\nUSER BENEFITS: ${userBenefits.length} benefit(s)`);
  if (userBenefits.length > 0) {
    userBenefits.slice(0, 2).forEach((b, i) => {
      console.log(`  ${i+1}. ${b.name} (Value: $${b.stickerValue / 100}, Used: ${b.isUsed})`);
    });
  }

  console.log(`\nACTIVE SESSIONS: ${sessions.filter(s => s.isValid && new Date(s.expiresAt) > new Date()).length}/${sessions.length}`);
  
} catch (e) {
  console.error("❌ Database error:", e.message);
}

// API Endpoints
console.log("\n[PART 2: API ENDPOINTS]");
console.log("-".repeat(100));

const apiDir = path.join(__dirname, 'src', 'app', 'api');

function getAllFiles(dir) {
  let files = [];
  try {
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        files = files.concat(getAllFiles(fullPath));
      } else if (item.endsWith('.ts')) {
        files.push(fullPath);
      }
    });
  } catch (e) {
    //
  }
  return files;
}

const apiFiles = getAllFiles(apiDir);
const endpoints = {};

apiFiles.forEach(file => {
  const relativePath = file.replace(apiDir, '').replace(/\/route\.ts$/, '');
  const route = '/api' + relativePath;
  
  try {
    const content = fs.readFileSync(file, 'utf8');
    const methods = [];
    
    if (content.includes('export async function GET')) methods.push('GET');
    if (content.includes('export async function POST')) methods.push('POST');
    if (content.includes('export async function PATCH')) methods.push('PATCH');
    if (content.includes('export async function DELETE')) methods.push('DELETE');
    
    const hasAuth = content.includes('getAuthUserId') || content.includes('getAuthContext');
    const hasDb = content.includes('prisma');
    
    endpoints[route] = { methods, hasAuth, hasDb };
  } catch (e) {
    //
  }
});

console.log(`\nFound ${Object.keys(endpoints).length} API endpoints:\n`);
Object.keys(endpoints).sort().forEach(route => {
  const ep = endpoints[route];
  const auth = ep.hasAuth ? '[Auth]' : '[No Auth]';
  const db = ep.hasDb ? '[DB]' : '[No DB]';
  console.log(`  ${route.padEnd(45)} ${ep.methods.join(',').padEnd(15)} ${auth} ${db}`);
});

// Form Components
console.log("\n[PART 3: FORM COMPONENTS]");
console.log("-".repeat(100));

const componentsDir = path.join(__dirname, 'src', 'components');
function getComponentFiles(dir) {
  let files = [];
  try {
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      if (item.includes('Modal') || item.includes('Dialog') || item.includes('Form')) {
        files.push(item);
      }
    });
  } catch (e) {
    //
  }
  return files;
}

const formComponents = getComponentFiles(componentsDir);
console.log(`\nFound ${formComponents.length} form components:\n`);
formComponents.forEach(comp => {
  try {
    const content = fs.readFileSync(path.join(componentsDir, comp), 'utf8');
    const hasFetch = content.includes('fetch(') || content.includes('fetch (');
    const apiCalls = [...new Set(content.match(/api\/[^\s"'`]+/g) || [])];
    
    console.log(`  ${comp.padEnd(40)} ${hasFetch ? '✓' : '✗'} API calls`);
    if (apiCalls.length > 0) {
      console.log(`    └─ Uses: ${apiCalls.slice(0, 2).join(', ')}`);
    }
  } catch (e) {
    //
  }
});

// Critical Checks
console.log("\n[PART 4: CRITICAL FINDINGS]");
console.log("-".repeat(100));

const issues = [];

// Check required endpoints
const required = ['/api/auth/login', '/api/auth/logout', '/api/cards/my-cards', '/api/cards/add', '/api/benefits/add'];
console.log("\n✓ Required Endpoints:");
required.forEach(ep => {
  const exists = Object.keys(endpoints).some(k => k === ep || k.startsWith(ep.replace('[id]', '')));
  if (exists) {
    console.log(`  ✓ ${ep}`);
  } else {
    console.log(`  ✗ ${ep} - MISSING!`);
    issues.push(`Missing: ${ep}`);
  }
});

// Check auth on protected endpoints
console.log("\n✓ Authentication on Protected Endpoints:");
const protectedEndpoints = Object.entries(endpoints)
  .filter(([route]) => route.includes('cards') || route.includes('benefits') || route.includes('user'))
  .filter(([route]) => !route.includes('available'));

let authIssuesCount = 0;
protectedEndpoints.slice(0, 5).forEach(([route, ep]) => {
  if (ep.hasAuth) {
    console.log(`  ✓ ${route} - Protected`);
  } else {
    console.log(`  ⚠ ${route} - NOT PROTECTED!`);
    authIssuesCount++;
  }
});

if (authIssuesCount > 0) {
  issues.push(`${authIssuesCount} protected endpoints missing auth checks`);
}

// Check database
console.log("\n✓ Database Data:");
if (users.length > 0) {
  console.log(`  ✓ ${users.length} user(s) in DB - Can test authenticated flows`);
} else {
  console.log(`  ✗ NO USERS - Endpoints cannot be tested`);
  issues.push('No users in database');
}

if (userCards.length > 0) {
  console.log(`  ✓ ${userCards.length} card(s) in DB - Persistence works`);
} else {
  console.log(`  ✓ 0 cards (may be normal for fresh DB)`);
}

const validSessions = sessions.filter(s => s.isValid && new Date(s.expiresAt) > new Date());
if (validSessions.length > 0) {
  console.log(`  ✓ ${validSessions.length} active session(s)`);
} else {
  console.log(`  ✗ NO ACTIVE SESSIONS - Users cannot access protected endpoints`);
  issues.push('No active sessions');
}

// Summary
console.log("\n" + "=".repeat(100));
console.log("SUMMARY");
console.log("=".repeat(100));

console.log(`\nStatistics:`);
console.log(`  • API Endpoints: ${Object.keys(endpoints).length}`);
console.log(`  • Protected: ${Object.values(endpoints).filter(e => e.hasAuth).length}`);
console.log(`  • Using DB: ${Object.values(endpoints).filter(e => e.hasDb).length}`);
console.log(`  • Form Components: ${formComponents.length}`);
console.log(`  • Database Users: ${users.length}`);
console.log(`  • Database Cards: ${userCards.length}`);
console.log(`  • Active Sessions: ${validSessions.length}`);

if (issues.length > 0) {
  console.log(`\n🔴 ISSUES FOUND (${issues.length}):`);
  issues.forEach((issue, i) => {
    console.log(`  ${i+1}. ${issue}`);
  });
} else {
  console.log(`\n✅ No critical issues`);
}

console.log("\n" + "=".repeat(100));

await prisma.$disconnect();
