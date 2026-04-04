import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

console.log("\n" + "=".repeat(100));
console.log("API & DATABASE INTEGRATION AUDIT REPORT");
console.log("=".repeat(100));

// ============================================================================
// PART 1: DATABASE CONTENTS
// ============================================================================
console.log("\n[PART 1: DATABASE CONTENTS]");
console.log("-".repeat(100));

try {
  const users = await prisma.user.findMany();
  const userCards = await prisma.userCard.findMany({ include: { masterCard: true, benefits: true } });
  const userBenefits = await prisma.userBenefit.findMany();
  const sessions = await prisma.session.findMany();

  console.log(`\nUSERS: ${users.length} user(s) in database`);
  users.forEach((u, i) => {
    console.log(`  ${i+1}. ${u.email} (ID: ${u.id})`);
  });

  console.log(`\nUSER CARDS: ${userCards.length} card(s)`);
  userCards.forEach((card, i) => {
    console.log(`  ${i+1}. ${card.masterCard?.cardName} (Status: ${card.status})`);
    console.log(`     - Renewal Date: ${card.renewalDate}`);
    console.log(`     - Annual Fee: $${card.actualAnnualFee / 100}`);
    console.log(`     - Benefits: ${card.benefits?.length || 0}`);
  });

  console.log(`\nUSER BENEFITS: ${userBenefits.length} benefit(s)`);
  userBenefits.slice(0, 3).forEach((b, i) => {
    console.log(`  ${i+1}. ${b.name} (Status: ${b.status})`);
    console.log(`     - Value: $${b.stickerValue / 100}`);
    console.log(`     - Is Used: ${b.isUsed}`);
  });

  console.log(`\nACTIVE SESSIONS: ${sessions.filter(s => s.isValid).length}/${sessions.length}`);
  
} catch (e) {
  console.error("❌ Database query failed:", e.message);
}

// ============================================================================
// PART 2: API CODE ANALYSIS
// ============================================================================
console.log("\n[PART 2: API ENDPOINT ANALYSIS]");
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
      } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
        files.push(fullPath);
      }
    });
  } catch (e) {
    console.error(`Error reading ${dir}:`, e.message);
  }
  return files;
}

const apiFiles = getAllFiles(apiDir);
console.log(`\nFound ${apiFiles.length} API files\n`);

const endpoints = {};
apiFiles.forEach(file => {
  const relativePath = file.replace(apiDir, '').replace(/\.[^.]+$/, '');
  const route = '/api' + relativePath.replace(/route$/, '');
  
  try {
    const content = fs.readFileSync(file, 'utf8');
    
    // Extract HTTP methods
    const methods = [];
    if (content.includes('export async function GET')) methods.push('GET');
    if (content.includes('export async function POST')) methods.push('POST');
    if (content.includes('export async function PATCH')) methods.push('PATCH');
    if (content.includes('export async function DELETE')) methods.push('DELETE');
    if (content.includes('export async function PUT')) methods.push('PUT');
    
    // Check for authentication
    const hasAuth = content.includes('getAuthUserId') || content.includes('isAuthenticated');
    const hasDbCall = content.includes('prisma');
    
    endpoints[route] = {
      methods: methods.length > 0 ? methods : ['Unknown'],
      hasAuth,
      hasDbCall,
      file: path.basename(file)
    };
  } catch (e) {
    console.error(`Error reading ${file}:`, e.message);
  }
});

// Display endpoints
Object.keys(endpoints).sort().forEach(route => {
  const ep = endpoints[route];
  const auth = ep.hasAuth ? '✓ Auth' : '✗ No Auth';
  const db = ep.hasDbCall ? '✓ DB' : '✗ No DB';
  console.log(`${route.padEnd(40)} ${ep.methods.join(',').padEnd(12)} [${auth}] [${db}]`);
});

// ============================================================================
// PART 3: FORM COMPONENTS ANALYSIS
// ============================================================================
console.log("\n[PART 3: FORM COMPONENTS ANALYSIS]");
console.log("-".repeat(100));

const componentsDir = path.join(__dirname, 'src', 'components');
const componentFiles = getAllFiles(componentsDir).filter(f => f.includes('Modal') || f.includes('Form') || f.includes('Dialog'));

console.log(`\nFound ${componentFiles.length} form/modal components:\n`);

componentFiles.forEach(file => {
  const name = path.basename(file);
  try {
    const content = fs.readFileSync(file, 'utf8');
    
    // Look for fetch/API calls
    const hasFetch = content.includes('fetch(') || content.includes('fetch (');
    const apiCalls = [...new Set(content.match(/api\/[^\s"'`)]+/g) || [])];
    
    console.log(`${name.padEnd(35)} ${hasFetch ? '✓ Calls API' : '✗ No API calls'}`);
    if (apiCalls.length > 0) {
      apiCalls.forEach(call => {
        console.log(`  └─ /api/${call.split('api/')[1]}`);
      });
    }
  } catch (e) {
    console.error(`Error reading ${file}:`, e.message);
  }
});

// ============================================================================
// PART 4: CRITICAL CHECKS
// ============================================================================
console.log("\n[PART 4: CRITICAL CHECKS]");
console.log("-".repeat(100));

const criticalIssues = [];

// Check 1: All required endpoints exist
const requiredEndpoints = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/cards/my-cards',
  '/api/cards/add',
  '/api/cards/[id]',
  '/api/benefits/add',
  '/api/benefits/[id]'
];

console.log("\n✓ Required Endpoints Check:");
requiredEndpoints.forEach(ep => {
  const exists = Object.keys(endpoints).some(k => 
    k === ep || k.match(new RegExp('^' + ep.replace('[id]', '[^/]+') + '$'))
  );
  if (exists) {
    console.log(`  ✓ ${ep}`);
  } else {
    console.log(`  ✗ ${ep} - MISSING`);
    criticalIssues.push(`Missing endpoint: ${ep}`);
  }
});

// Check 2: Database has data
console.log("\n✓ Database Data Check:");
if (users.length > 0) {
  console.log(`  ✓ ${users.length} user(s) in database`);
} else {
  console.log(`  ✗ NO USERS - Cannot test authenticated endpoints`);
  criticalIssues.push('No users in database');
}

if (userCards.length > 0) {
  console.log(`  ✓ ${userCards.length} card(s) in database - Data persistence works`);
} else {
  console.log(`  ⚠ No cards - May be normal for fresh database`);
}

if (userBenefits.length > 0) {
  console.log(`  ✓ ${userBenefits.length} benefit(s) in database`);
}

// Check 3: Sessions active
console.log("\n✓ Session Check:");
const validSessions = sessions.filter(s => s.isValid && new Date(s.expiresAt) > new Date());
if (validSessions.length > 0) {
  console.log(`  ✓ ${validSessions.length} valid active session(s)`);
} else {
  console.log(`  ✗ NO VALID SESSIONS - Users may not be authenticated`);
  criticalIssues.push('No active valid sessions');
}

// ============================================================================
// SUMMARY
// ============================================================================
console.log("\n" + "=".repeat(100));
console.log("SUMMARY");
console.log("=".repeat(100));

console.log(`\n📊 Statistics:`);
console.log(`  • Total API Endpoints: ${Object.keys(endpoints).length}`);
console.log(`  • Endpoints with Auth: ${Object.values(endpoints).filter(e => e.hasAuth).length}`);
console.log(`  • Endpoints with DB: ${Object.values(endpoints).filter(e => e.hasDbCall).length}`);
console.log(`  • Users: ${users.length}`);
console.log(`  • Cards: ${userCards.length}`);
console.log(`  • Benefits: ${userBenefits.length}`);
console.log(`  • Active Sessions: ${validSessions.length}`);

if (criticalIssues.length > 0) {
  console.log(`\n🔴 CRITICAL ISSUES FOUND (${criticalIssues.length}):`);
  criticalIssues.forEach((issue, i) => {
    console.log(`  ${i+1}. ${issue}`);
  });
} else {
  console.log(`\n✅ No critical issues found`);
}

console.log("\n" + "=".repeat(100));

await prisma.$disconnect();
