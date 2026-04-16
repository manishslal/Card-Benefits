/**
 * Seed: Lounge Module Reference Data
 *
 * Idempotent — safe to run multiple times.
 * Creates airports, access methods, and card-to-access-method links.
 *
 * Usage: npx tsx scripts/seed-lounge-data.ts
 *        npm run seed:lounges
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Data: Top 10 US Airports
// ---------------------------------------------------------------------------
const AIRPORTS = [
  { iataCode: 'ATL', name: 'Hartsfield-Jackson Atlanta International Airport', city: 'Atlanta', timezone: 'America/New_York' },
  { iataCode: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', timezone: 'America/Los_Angeles' },
  { iataCode: 'ORD', name: "O'Hare International Airport", city: 'Chicago', timezone: 'America/Chicago' },
  { iataCode: 'DFW', name: 'Dallas/Fort Worth International Airport', city: 'Dallas', timezone: 'America/Chicago' },
  { iataCode: 'DEN', name: 'Denver International Airport', city: 'Denver', timezone: 'America/Denver' },
  { iataCode: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', timezone: 'America/New_York' },
  { iataCode: 'MCO', name: 'Orlando International Airport', city: 'Orlando', timezone: 'America/New_York' },
  { iataCode: 'LAS', name: 'Harry Reid International Airport', city: 'Las Vegas', timezone: 'America/Los_Angeles' },
  { iataCode: 'MIA', name: 'Miami International Airport', city: 'Miami', timezone: 'America/New_York' },
  { iataCode: 'CLT', name: 'Charlotte Douglas International Airport', city: 'Charlotte', timezone: 'America/New_York' },
] as const;

// ---------------------------------------------------------------------------
// Data: Access Methods (networks / statuses / ticket classes first, then cards)
// ---------------------------------------------------------------------------

// Methods that do NOT have a grantsNetworkId — created first
const STANDALONE_METHODS = [
  { name: 'Priority Pass Select', category: 'Lounge Network', provider: 'Collinson Group' },
  { name: 'DragonPass',           category: 'Lounge Network', provider: 'DragonPass' },
  { name: 'United Club Membership',     category: 'Lounge Network', provider: 'United Airlines' },
  { name: 'Delta Sky Club Membership',  category: 'Lounge Network', provider: 'Delta Air Lines' },
  { name: 'Star Alliance Gold',   category: 'Airline Status', provider: null },
  { name: 'Oneworld Emerald',     category: 'Airline Status', provider: null },
  { name: 'First Class Ticket',   category: 'Ticket Class',   provider: null },
  { name: 'Business Class Ticket', category: 'Ticket Class',  provider: null },
  { name: 'Amex Gold',            category: 'Credit Card',    provider: 'American Express' },
] as const;

// Methods that grant access to Priority Pass Select network
const NETWORK_GRANT_METHODS = [
  { name: 'Amex Platinum',            category: 'Credit Card', provider: 'American Express' },
  { name: 'Chase Sapphire Reserve',   category: 'Credit Card', provider: 'Chase' },
  { name: 'Capital One Venture X',    category: 'Credit Card', provider: 'Capital One' },
] as const;

// ---------------------------------------------------------------------------
// Data: Card → Access Method links
// ---------------------------------------------------------------------------
const CARD_ACCESS_LINKS = [
  {
    issuer: 'American Express',
    cardName: 'American Express Platinum Card',
    methods: ['Amex Platinum', 'Priority Pass Select'],
  },
  {
    issuer: 'Chase',
    cardName: 'Chase Sapphire Reserve',
    methods: ['Chase Sapphire Reserve', 'Priority Pass Select'],
  },
  {
    issuer: 'Capital One',
    cardName: 'Capital One Venture X',
    methods: ['Capital One Venture X', 'Priority Pass Select'],
  },
] as const;

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------
async function seedLoungeData() {
  console.log('🛫 Seeding lounge reference data...');

  // 1. Upsert airports
  console.log('  ✈️  Upserting airports...');
  for (const airport of AIRPORTS) {
    await prisma.loungeAirport.upsert({
      where: { iataCode: airport.iataCode },
      create: { ...airport },
      update: { name: airport.name, city: airport.city, timezone: airport.timezone },
    });
  }
  console.log(`     ${AIRPORTS.length} airports upserted`);

  // 2. Upsert standalone access methods (no self-reference)
  console.log('  🔑 Upserting standalone access methods...');
  for (const method of STANDALONE_METHODS) {
    await prisma.loungeAccessMethod.upsert({
      where: { id: await findAccessMethodId(method.name) },
      create: { name: method.name, category: method.category, provider: method.provider },
      update: { category: method.category, provider: method.provider },
    });
  }
  console.log(`     ${STANDALONE_METHODS.length} standalone methods upserted`);

  // 3. Fetch the Priority Pass Select record for self-references
  const priorityPass = await prisma.loungeAccessMethod.findFirst({
    where: { name: 'Priority Pass Select' },
  });
  if (!priorityPass) {
    throw new Error('Priority Pass Select not found — standalone methods must be seeded first');
  }

  // 4. Upsert credit-card methods that grant Priority Pass network access
  console.log('  💳 Upserting network-grant access methods...');
  for (const method of NETWORK_GRANT_METHODS) {
    await prisma.loungeAccessMethod.upsert({
      where: { id: await findAccessMethodId(method.name) },
      create: {
        name: method.name,
        category: method.category,
        provider: method.provider,
        grantsNetworkId: priorityPass.id,
      },
      update: {
        category: method.category,
        provider: method.provider,
        grantsNetworkId: priorityPass.id,
      },
    });
  }
  console.log(`     ${NETWORK_GRANT_METHODS.length} network-grant methods upserted`);

  // 5. Link cards to access methods
  console.log('  🔗 Linking cards to access methods...');
  let linked = 0;
  for (const link of CARD_ACCESS_LINKS) {
    const card = await prisma.masterCard.findFirst({
      where: { issuer: link.issuer, cardName: link.cardName },
    });
    if (!card) {
      console.warn(`     ⚠️  Card not found: ${link.issuer} "${link.cardName}" — skipping`);
      continue;
    }

    for (const methodName of link.methods) {
      const method = await prisma.loungeAccessMethod.findFirst({
        where: { name: methodName },
      });
      if (!method) {
        console.warn(`     ⚠️  Access method not found: "${methodName}" — skipping`);
        continue;
      }

      await prisma.cardLoungeAccess.upsert({
        where: {
          cardId_accessMethodId: {
            cardId: card.id,
            accessMethodId: method.id,
          },
        },
        create: { cardId: card.id, accessMethodId: method.id },
        update: {},
      });
      linked++;
    }
  }
  console.log(`     ${linked} card-access links upserted`);

  // 6. Summary
  const airportCount = await prisma.loungeAirport.count();
  const methodCount = await prisma.loungeAccessMethod.count();
  const linkCount = await prisma.cardLoungeAccess.count();
  console.log('');
  console.log('✅ Lounge reference data seeded successfully');
  console.log(`   📊 ${airportCount} airports | ${methodCount} access methods | ${linkCount} card-access links`);
}

// ---------------------------------------------------------------------------
// Helper: find an access method ID by name, or return a dummy for upsert
// ---------------------------------------------------------------------------
async function findAccessMethodId(name: string): Promise<string> {
  const existing = await prisma.loungeAccessMethod.findFirst({ where: { name } });
  // Return existing ID if found; otherwise return a dummy CUID that won't match,
  // forcing the upsert to take the `create` path.
  return existing?.id ?? 'nonexistent_placeholder_id';
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------
seedLoungeData()
  .catch((e) => {
    console.error('❌ Lounge seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
