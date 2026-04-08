const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function auditForReport() {
  const cards = await prisma.masterCard.findMany({
    include: { masterBenefits: true },
    orderBy: [{ issuer: 'asc' }, { cardName: 'asc' }]
  });
  
  const allBenefits = [];
  cards.forEach(card => {
    card.masterBenefits.forEach(b => {
      allBenefits.push({ cardName: card.cardName, issuer: card.issuer, ...b });
    });
  });
  
  // Identify specific issues
  const benefitsNeedingMonthlyLogic = [
    'Uber Cash', 'Uber Credit', 'Dining Credit', 'DoorDash', 'Uber Eats',
    'Disney', 'Peacock', 'Monthly'
  ];
  
  const suspiciousMonthlyBenefits = allBenefits.filter(b => 
    benefitsNeedingMonthlyLogic.some(keyword => b.name.toLowerCase().includes(keyword.toLowerCase()))
  );
  
  // Benefits with annual statement credits but CUSTOM reset (inconsistent)
  const annualStatementCreditWithCustom = allBenefits.filter(b =>
    b.type === 'StatementCredit' && 
    b.stickerValue > 10000 && 
    b.resetCadence === 'CUSTOM' &&
    b.name.toLowerCase().includes('annual')
  );
  
  console.log('DETAILED FINDINGS FOR REPORT\n');
  console.log('='.repeat(80));
  console.log('MISMATCHED/SUSPICIOUS BENEFITS');
  console.log('='.repeat(80));
  
  console.log('\n1. ANNUAL Statement Credits with CUSTOM reset (should be ANNUAL):');
  if (annualStatementCreditWithCustom.length > 0) {
    annualStatementCreditWithCustom.forEach(b => {
      console.log(`   • ${b.issuer} ${b.cardName}`);
      console.log(`     Benefit: "${b.name}"`);
      console.log(`     Issue: resetCadence=CUSTOM but name says "Annual"`);
    });
  } else {
    console.log('   ✓ None found');
  }
  
  console.log('\n2. Benefits that LOOK like they should be MONTHLY:');
  console.log(`   Total identified: ${suspiciousMonthlyBenefits.length}`);
  suspiciousMonthlyBenefits.slice(0, 15).forEach(b => {
    console.log(`   • ${b.issuer} ${b.cardName}: "${b.name}"`);
    console.log(`     Current resetCadence: ${b.resetCadence}`);
  });
  
  // All statement credits analysis
  const allStatementCredits = allBenefits.filter(b => b.type === 'StatementCredit');
  const statementCreditsByCadence = {};
  
  allStatementCredits.forEach(b => {
    const key = b.resetCadence || 'NULL';
    if (!statementCreditsByCadence[key]) statementCreditsByCadence[key] = [];
    statementCreditsByCadence[key].push(b);
  });
  
  console.log('\n3. ALL Statement Credit Benefits by resetCadence:');
  Object.keys(statementCreditsByCadence).sort().forEach(cadence => {
    console.log(`\n   ${cadence} (${statementCreditsByCadence[cadence].length} benefits):`);
    statementCreditsByCadence[cadence].forEach(b => {
      console.log(`     • ${b.cardName}: ${b.name}`);
    });
  });
  
  // Summary stats
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY STATS');
  console.log('='.repeat(80));
  console.log(`\nTotal Cards: ${cards.length}`);
  console.log(`Total Benefits: ${allBenefits.length}`);
  console.log(`\nStatement Credits: ${allStatementCredits.length}`);
  console.log(`  - With ANNUAL: ${allStatementCredits.filter(b => b.resetCadence === 'ANNUAL').length}`);
  console.log(`  - With CUSTOM: ${allStatementCredits.filter(b => b.resetCadence === 'CUSTOM').length}`);
  console.log(`  - With CalendarYear: ${allStatementCredits.filter(b => b.resetCadence === 'CalendarYear').length}`);
  console.log(`  - With CardmemberYear: ${allStatementCredits.filter(b => b.resetCadence === 'CardmemberYear').length}`);
  
  // Duplicates check
  const cardCounts = {};
  cards.forEach(c => {
    const key = `${c.issuer}|${c.cardName}`;
    cardCounts[key] = (cardCounts[key] || 0) + 1;
  });
  
  const duplicates = Object.entries(cardCounts).filter(([_, count]) => count > 1);
  console.log(`\nDuplicate Cards: ${duplicates.length}`);
  duplicates.forEach(([name, count]) => {
    console.log(`  ⚠️  ${name} appears ${count} times`);
  });
  
  await prisma.$disconnect();
}

auditForReport().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
