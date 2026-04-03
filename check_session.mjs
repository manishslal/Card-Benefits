import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const sessions = await prisma.session.findMany({
    where: {
      userId: 'cmnj5ky1x0000pnoso2ecwtqa',
    },
    select: {
      id: true,
      sessionToken: true,
      isValid: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 5,
  });

  console.log('Found sessions:', sessions.length);
  sessions.forEach((s) => {
    console.log(JSON.stringify({
      id: s.id,
      token_length: s.sessionToken ? s.sessionToken.length : 0,
      token_preview: s.sessionToken ? s.sessionToken.substring(0, 50) : 'EMPTY',
      isValid: s.isValid,
      expiresAt: s.expiresAt,
    }, null, 2));
  });

  const user = await prisma.user.findUnique({
    where: { id: 'cmnj5ky1x0000pnoso2ecwtqa' },
    select: { email: true },
  });
  console.log('User:', user?.email || 'NOT FOUND');
} finally {
  await prisma.$disconnect();
}
