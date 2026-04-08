const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function audit() {
  const cards = await prisma.masterCard.findMany({
    include: { masterBenefits: true },
    orderBy: { displayOrder: 'asc' }
  });
  
  console.log('=== MASTERCARD & MASTERBENEFIT AUDIT ===\n');
  console.log(`Total Cards: ${cards.length}`);
  
  let totalBenefits = 0;
  let benefitsWithoutClaimingCadence = 0;
  let benefitsWithoutResetCadence = 0;
  
  const missingClaimingCadence = [];
  const missingResetCadence = [];
  const mismatchedCadence = [];
  
  cards.forEach(card => {
    totalBenefits += card.masterBenefits.length;
    
    card.masterBenefits.forEach(b => {
      if (!b.claimingCadence) {
        benefitsWithoutClaimingCadence++;
        missingClaimingCadence.push(`${card.cardName} - ${b.name}`);
      }
      if (!b.resetCadence) {
        benefitsWithoutResetCadence++;
        missingResetCadence.push(`${card.cardName} - ${b.name}`);
      }
      // Check for mismatches
      if (b.claimingCadence && b.resetCadence && b.claimingCadence !== b.resetCadence) {
        mismatchedCadence.push({
          card: card.cardName,
          benefit: b.name,
          claiming: b.claimingCadence,
          reset: b.resetCadence
        });
      }
    });
  });
  
  console.log(`Total Benefits: ${totalBenefits}`);
  console.log(`\nCadence Field Analysis:`);
  console.log(`  Benefits missing claimingCadence: ${benefitsWithoutClaimingCadence}`);
  console.log(`  Benefits missing resetCadence: ${benefitsWithoutResetCadence}`);
  console.log(`  Cadence mismatches (claiming != reset): ${mismatchedCadence.length}`);
  
  if (mismatchedCadence.length > 0) {
    console.log(`\n  ⚠️  Mismatched Cadence Examples:`);
    mismatchedCadence.slice(0, 10).forEach(m => {
      console.log(`    - ${m.card} / ${m.benefit}`);
      console.log(`      resetCadence=${m.reset}, claimingCadence=${m.claiming}`);
    });
  }
  
  console.log(`\n=== CARD BREAKDOWN (first 15 cards) ===`);
  cards.slice(0, 15).forEach(card => {
    console.log(`\n${card.issuer} - ${card.cardName}`);
    console.log(`  Annual Fee: $${(card.defaultAnnualFee/100).toFixed(2)}`);
    console.log(`  Benefits: ${card.masterBenefits.length}`);
    card.masterBenefits.slice(0, 5).forEach(b => {
      const cadence = b.claimingCadence || 'NULL';
      const reset = b.resetCadence || 'NULL';
      const amount = b.claimingAmount !== null ? `$${(b.claimingAmount/100).toFixed(2)}` : 'NULL';
      console.log(`    - ${b.name}`);
      console.log(`      resetCadence=${reset}, claimingCadence=${cadence}, claimingAmount=${amount}`);
    });
  });
  
  console.log('\n');
  await prisma.$disconnect();
}

audit().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
