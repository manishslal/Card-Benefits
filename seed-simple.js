const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // Just delete and create a simple user
    await prisma.user.deleteMany();
    
    const user = await prisma.user.create({
      data: { 
        email: 'demo@example.com', 
        passwordHash: 'hashedpassword123'
      },
    });
    
    console.log('✅ Demo user created!');
    console.log('Email:', user.email);
    console.log('ID:', user.id);
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
