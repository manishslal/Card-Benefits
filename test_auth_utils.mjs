import jwt from 'jsonwebtoken';

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbW5qNWt5MXgwMDAwcG5vc28yZWN3dHFhIiwiaXNzdWVkQXQiOjE3NzUyNDIyNzYsImV4cGlyZXNBdCI6MTc3NzgzNDI3Niwic2Vzc2lvbklkIjoiY21uajllejltMDAwaDEzNml4bDRiNDI1eCIsInZlcnNpb24iOjEsImlhdCI6MTc3NTI0MjI3NiwiZXhwIjoxNzc3ODM0Mjc2fQ.zI6l9FU_lKilYy8r9rzYaI4R3GmSAg9wrtkCzCFLYns';

// Get secret from env
const secret = process.env.SESSION_SECRET;
console.log('SESSION_SECRET exists?', !!secret);

if (!secret) {
  console.error('❌ SESSION_SECRET not set in environment');
  process.exit(1);
}

try {
  console.log('Verifying JWT with HS256...');
  const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
  console.log('✓ JWT verified successfully');
  console.log('Payload:', payload);
  
  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  const isExpired = payload.expiresAt < now;
  console.log(`\nExpiration check:`);
  console.log(`  Now: ${now}`);
  console.log(`  Expires at: ${payload.expiresAt}`);
  console.log(`  Expired?: ${isExpired}`);
} catch (error) {
  console.error('❌ JWT verification failed:');
  console.error('  Error:', error.message);
}
