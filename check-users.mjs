import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

try {
  const users = await prisma.user.findMany({ take: 5 });
  console.log('✅ Users found:', users.length);
  users.forEach(u => console.log(`  - ${u.email} (ID: ${u.id})`));
  
  if (users.length === 0) {
    console.log('\n⚠️  No users in database. Creating demo user...');
  }
} catch (error) {
  console.error('❌ Error:', error.message);
} finally {
  await prisma.$disconnect();
}
