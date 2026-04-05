const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function main() {
  try {
    // Create a simple hash for testing (NOT for production!)
    const hash = crypto.createHash('sha256').update('password123').digest('hex');
    
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        passwordHash: hash,
        firstName: 'Test',
        lastName: 'User',
        emailVerified: true
      }
    });
    
    console.log('✅ Test user created!');
    console.log('  Email: test@example.com');
    console.log('  Password: password123');
    console.log('  ID:', user.id);
  } catch (error) {
    if (error.code === 'P2002') {
      console.log('✅ Test user already exists');
    } else {
      console.error('❌ Error:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
