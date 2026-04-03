import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// The exact token from our login
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbW5qNWt5MXgwMDAwcG5vc28yZWN3dHFhIiwiaXNzdWVkQXQiOjE3NzUyNDIyNzYsImV4cGlyZXNBdCI6MTc3NzgzNDI3Niwic2Vzc2lvbklkIjoiY21uajllejltMDAwaDEzNml4bDRiNDI1eCIsInZlcnNpb24iOjEsImlhdCI6MTc3NTI0MjI3NiwiZXhwIjoxNzc3ODM0Mjc2fQ.zI6l9FU_lKilYy8r9rzYaI4R3GmSAg9wrtkCzCFLYns';

console.log('Testing database lookup for token...');
console.log('Token:', token.substring(0, 50) + '...');

try {
  const session = await prisma.session.findUnique({
    where: { sessionToken: token },
    select: {
      id: true,
      userId: true,
      isValid: true,
      expiresAt: true,
    },
  });

  if (session) {
    console.log('✓ Session found in database:');
    console.log('  ID:', session.id);
    console.log('  User ID:', session.userId);
    console.log('  Valid:', session.isValid);
    console.log('  Expires:', session.expiresAt);
  } else {
    console.log('✗ Session NOT found in database');
    console.log('  Checking all sessions for this user...');
    const allSessions = await prisma.session.findMany({
      where: { userId: 'cmnj5ky1x0000pnoso2ecwtqa' },
      select: {
        id: true,
        sessionToken: true,
        userId: true,
        expiresAt: true,
      },
      take: 3,
    });
    console.log(`  Found ${allSessions.length} sessions for this user:`);
    allSessions.forEach((s) => {
      console.log(`    - ID: ${s.id}, Token prefix: ${s.sessionToken.substring(0, 30)}...`);
    });
  }
} catch (error) {
  console.error('✗ Error:', error.message);
} finally {
  await prisma.$disconnect();
}
