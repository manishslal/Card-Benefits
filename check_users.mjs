import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

try {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, firstName: true, lastName: true }
  });
  console.log('Total users:', users.length);
  if (users.length > 0) {
    console.log('Sample users:', JSON.stringify(users.slice(0, 3), null, 2));
  }
  
  const cards = await prisma.userCard.findMany();
  console.log('\nTotal cards:', cards.length);
  
  const benefits = await prisma.userBenefit.findMany();
  console.log('Total benefits:', benefits.length);
  
} catch (e) {
  console.error('Error:', e.message);
} finally {
  await prisma.$disconnect();
}
