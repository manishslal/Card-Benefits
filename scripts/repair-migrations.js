/**
 * Emergency migration repair script.
 * 
 * Resolves failed migrations by marking them as successful in _prisma_migrations table.
 * This is only used when migrations are blocked due to failed history.
 * 
 * Usage: node scripts/repair-migrations.js
 */

const { PrismaClient } = require('@prisma/client');

async function repairMigrations() {
  const prisma = new PrismaClient();

  try {
    console.log('🔧 Checking migration history...');

    // Get failed migrations
    const failedMigrations = await prisma.$queryRaw`
      SELECT id, checksum, finished_at FROM "_prisma_migrations" 
      WHERE success = false 
      ORDER BY started_at DESC
    `;

    if (failedMigrations.length === 0) {
      console.log('✅ No failed migrations found. Migration history is clean.');
      return;
    }

    console.log(`⚠️  Found ${failedMigrations.length} failed migration(s):`);
    failedMigrations.forEach((m) => {
      console.log(`   - ${m.id}`);
    });

    // Mark the problematic sprint1_variable_amounts as resolved if it exists
    const sprintMigration = await prisma.$queryRaw`
      SELECT id FROM "_prisma_migrations" 
      WHERE id LIKE '%sprint1_variable_amounts%'
    `;

    if (sprintMigration.length > 0) {
      console.log('\n🛠️  Marking sprint1_variable_amounts as resolved...');
      await prisma.$executeRaw`
        UPDATE "_prisma_migrations" 
        SET success = true, finished_at = NOW(), execution_time_in_millis = 0
        WHERE id LIKE '%sprint1_variable_amounts%'
      `;
      console.log('✅ Migration marked as resolved.');
    }

    // Also ensure variableAmounts column exists
    console.log('\n🔍 Verifying variableAmounts column exists...');
    const columnExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'MasterBenefit' AND column_name = 'variableAmounts'
      );
    `;

    if (columnExists[0].exists) {
      console.log('✅ variableAmounts column already exists.');
    } else {
      console.log('⚠️  Adding missing variableAmounts column...');
      await prisma.$executeRaw`
        ALTER TABLE "MasterBenefit" ADD COLUMN IF NOT EXISTS "variableAmounts" JSONB
      `;
      console.log('✅ variableAmounts column created.');
    }

    console.log('\n🎉 Migration repair complete!');
  } catch (error) {
    console.error('❌ Error during migration repair:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

repairMigrations();
