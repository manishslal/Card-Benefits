const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fullAudit() {
  const cards = await prisma.masterCard.findMany({
    include: { masterBenefits: true },
    orderBy: [{ issuer: 'asc' }, { cardName: 'asc' }]
  });
  
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║        COMPLETE MASTERBENEFIT CATALOG AUDIT REPORT            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  let totalBenefits = 0;
  let statementCredits = 0;
  let perks = 0;
  let rewards = 0;
  let monthlyResets = 0;
  let annualResets = 0;
  let customResets = 0;
  
  // Collect all benefits for analysis
  const allBenefits = [];
  
  cards.forEach(card => {
    card.masterBenefits.forEach(b => {
      totalBenefits++;
      allBenefits.push({
        cardName: card.cardName,
        issuer: card.issuer,
        ...b
      });
      
      if (b.type === 'StatementCredit') statementCredits++;
      if (['UsagePerk', 'TravelPerk', 'Insurance', 'Protection', 'Service'].includes(b.type)) perks++;
      if (['Rewards', 'Points'].includes(b.type)) rewards++;
      
      if (b.resetCadence === 'MONTHLY') monthlyResets++;
      if (b.resetCadence === 'ANNUAL' || b.resetCadence === 'CalendarYear' || b.resetCadence === 'CardmemberYear') annualResets++;
      if (b.resetCadence === 'CUSTOM') customResets++;
    });
  });
  
  console.log('INVENTORY SUMMARY');
  console.log('═════════════════════════════════════════\n');
  console.log(`  Total Master Cards:                    ${cards.length}`);
  console.log(`  Total Master Benefits:                 ${totalBenefits}`);
  console.log(`  Average Benefits per Card:             ${(totalBenefits/cards.length).toFixed(1)}\n`);
  
  console.log('BENEFIT TYPE DISTRIBUTION');
  console.log('─────────────────────────────────────────');
  console.log(`  Statement Credits:                     ${statementCredits}`);
  console.log(`  Travel/Usage Perks:                    ${perks}`);
  console.log(`  Rewards Programs:                      ${rewards}\n`);
  
  console.log('RESET CADENCE DISTRIBUTION');
  console.log('─────────────────────────────────────────');
  console.log(`  ANNUAL cadence:                        ${annualResets}`);
  console.log(`  MONTHLY cadence:                       ${monthlyResets}`);
  console.log(`  CUSTOM cadence:                        ${customResets}\n`);
  
  // Analysis
  console.log('CADENCE FIELD COMPLIANCE');
  console.log('═════════════════════════════════════════\n');
  
  const claimingCadencePopulated = allBenefits.filter(b => b.claimingCadence).length;
  const claimingAmountPopulated = allBenefits.filter(b => b.claimingAmount !== null).length;
  const claimingWindowEndPopulated = allBenefits.filter(b => b.claimingWindowEnd).length;
  
  console.log(`  claimingCadence populated:             ${claimingCadencePopulated}/${totalBenefits} (${((claimingCadencePopulated/totalBenefits)*100).toFixed(1)}%)`);
  console.log(`  claimingAmount populated:              ${claimingAmountPopulated}/${totalBenefits} (${((claimingAmountPopulated/totalBenefits)*100).toFixed(1)}%)`);
  console.log(`  claimingWindowEnd populated:           ${claimingWindowEndPopulated}/${totalBenefits} (${((claimingWindowEndPopulated/totalBenefits)*100).toFixed(1)}%)\n`);
  
  // Identify mismatches
  console.log('ISSUE DETECTION');
  console.log('═════════════════════════════════════════\n');
  
  const monthlyBenefits = allBenefits.filter(b => 
    b.resetCadence === 'MONTHLY' || 
    (b.name && (b.name.includes('Monthly') || b.name.includes('monthly')))
  );
  
  const annualSplitBenefits = allBenefits.filter(b => 
    b.name && (b.name.includes('Jan–Jun') || b.name.includes('Jul–Dec') || b.name.includes('(Jan') || b.name.includes('(Jul'))
  );
  
  console.log(`  ⚠️  MONTHLY benefits identified:       ${monthlyBenefits.length}`);
  if (monthlyBenefits.length > 0) {
    monthlyBenefits.forEach(b => {
      console.log(`      - ${b.issuer} ${b.cardName}: "${b.name}"`);
    });
  }
  console.log('');
  
  console.log(`  ⚠️  SPLIT-ANNUAL benefits:             ${annualSplitBenefits.length}`);
  if (annualSplitBenefits.length > 0) {
    annualSplitBenefits.forEach(b => {
      console.log(`      - "${b.name}"`);
    });
  }
  console.log('');
  
  // Benefits with NULL stickerValue but resetCadence populated (suspicious)
  const nullStickerWithReset = allBenefits.filter(b => b.stickerValue === 0 && b.resetCadence);
  console.log(`  ℹ️   Benefits with $0 stickerValue:      ${nullStickerWithReset.length}`);
  console.log(`       (Usually perks/rewards with no dollar value)\n`);
  
  // Show all cards with their benefit counts
  console.log('\nDETAILED CARD LISTING');
  console.log('═════════════════════════════════════════\n');
  
  cards.forEach((card, idx) => {
    const fee = (card.defaultAnnualFee / 100).toFixed(2);
    console.log(`${idx + 1}. ${card.issuer} - ${card.cardName}`);
    console.log(`   Fee: $${fee} | Benefits: ${card.masterBenefits.length} | Active: ${card.isActive} | Archived: ${card.isArchived}`);
    
    // Sample benefits
    const hasClaimingCadence = card.masterBenefits.filter(b => b.claimingCadence).length;
    console.log(`   Claiming Cadence: ${hasClaimingCadence}/${card.masterBenefits.length} populated`);
    
    // Show problematic benefits
    const problematicBenefits = card.masterBenefits.filter(b => 
      b.stickerValue > 0 && (!b.claimingCadence || !b.claimingAmount)
    );
    
    if (problematicBenefits.length > 0) {
      console.log(`   ⚠️  Benefits missing cadence fields: ${problematicBenefits.length}`);
      problematicBenefits.slice(0, 2).forEach(b => {
        console.log(`       • ${b.name}: claimingCadence=${b.claimingCadence ? 'SET' : 'NULL'}, claimingAmount=${b.claimingAmount !== null ? `$${(b.claimingAmount/100).toFixed(2)}` : 'NULL'}`);
      });
    }
    
    console.log('');
  });
  
  console.log('\nCRITICAL ISSUES SUMMARY');
  console.log('═════════════════════════════════════════\n');
  
  const totalStatementCreditsBenefit = allBenefits.filter(b => b.type === 'StatementCredit' && b.stickerValue > 0);
  const statementCreditsWithoutClaiming = totalStatementCreditsBenefit.filter(b => !b.claimingCadence);
  
  console.log(`🔴 CRITICAL:`);
  console.log(`   ${statementCreditsWithoutClaiming.length}/${totalStatementCreditsBenefit.length} statement credit benefits missing claimingCadence`);
  console.log(`   (These are needed for claiming logic!)\n`);
  
  console.log(`🟡 WARNINGS:`);
  console.log(`   ${monthlyBenefits.length} MONTHLY benefits - need claimingCadence='MONTHLY'`);
  console.log(`   ${annualSplitBenefits.length} split-annual benefits - may need custom claimingWindowEnd`);
  console.log('');
  
  await prisma.$disconnect();
}

fullAudit().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
