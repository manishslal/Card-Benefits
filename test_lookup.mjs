import { getSessionByToken, userExists } from './src/lib/auth-server.js';

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbW5qNWt5MXgwMDAwcG5vc28yZWN3dHFhIiwiaXNzdWVkQXQiOjE3NzUyNDE5NzQsImV4cGlyZXNBdCI6MTc3NzgzMzk3NCwic2Vzc2lvbklkIjoiY21uajk4aTNoMDAwZjEzNml1eGozbXpiaiIsInZlcnNpb24iOjEsImlhdCI6MTc3NTI0MTk3NCwiZXhwIjoxNzc3ODMzOTc0fQ.YXAEsrVYL1lCtU8IBr3zEt82WT1zRO_O0F-j1ADCjGU';
const userId = 'cmnj5ky1x0000pnoso2ecwtqa';

console.log('Testing getSessionByToken...');
try {
  const session = await getSessionByToken(token);
  console.log('Session found:', session ? 'YES' : 'NO');
  if (session) console.log('Session:', session);
} catch (e) {
  console.error('Error:', e.message);
}

console.log('\nTesting userExists...');
try {
  const exists = await userExists(userId);
  console.log('User exists:', exists);
} catch (e) {
  console.error('Error:', e.message);
}
