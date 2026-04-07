# Database Safety Policy

## Critical Rule: NEVER Run Migrations Locally on Production Database

### The Danger
Migrations can:
- ❌ Delete all user data
- ❌ Drop tables permanently
- ❌ Corrupt database schema
- ❌ Make production inaccessible

### How We Protect Against This

#### 1. Automatic Validation (Always Active)
When you run ANY database command:
```bash
npm run prisma:migrate
npm run db:push
npm run db:reset
```

A validation script **automatically checks**:
- ✅ Is this a local database? (Safe to modify)
- ❌ Is this a production database? (Block operation)

#### 2. Connection String Protection
Your `.env` file contains `DATABASE_URL`:

**SAFE** (Local development):
```
DATABASE_URL="file:./dev.db"
DATABASE_URL="postgresql://localhost:5432/..."
DATABASE_URL="postgres://127.0.0.1/..."
```

**PRODUCTION** (Protected):
```
DATABASE_URL="postgresql://...junction.proxy.rlwy.net..."
DATABASE_URL="postgres://...prod-..."
DATABASE_URL="...production..."
```

### Proper Migration Workflow

#### For Local Development
```bash
# Safe - Only affects your local database
npm run db:reset              # Resets local SQLite
npm run prisma:migrate        # Adds new migrations locally
npm run prisma:studio         # View/edit data locally
```

#### For Production
```bash
# NEVER run these on production from local machine

# ❌ DON'T DO:
npm run prisma:migrate        # From your laptop
npm run db:push               # From your laptop
npm run db:reset              # From your laptop

# ✅ DO THIS INSTEAD:
# 1. Commit schema changes to Git
# 2. Create a PR and get code review
# 3. Merge to main
# 4. Deploy through Railway (uses CI/CD pipeline)
# 5. Rails runs migrations safely in controlled environment
```

### What Happens If You Try Anyway

**You'll see:**
```
🔐 Database Connection Validator
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Database: junction.proxy.rlwy.net
🏷️  Environment: 🔴 PRODUCTION

❌ DANGER: Attempting database operation on PRODUCTION database!

This operation could:
  • Delete all user data
  • Destroy production database
  • Cause data loss

✋ BLOCKED - This is not allowed from local development.
```

Operation is **blocked** ✋

### Emergency Override (DANGEROUS)
If you absolutely must run migrations on production:

```bash
ALLOW_PROD_MIGRATION=true npm run db:push
```

⚠️ **WARNING**: This is dangerous! Only use if:
- You have a fresh backup
- You're absolutely certain
- You understand the consequences

### Best Practices

1. **Keep Environments Separate**
   ```
   Local Dev: SQLite (dev.db)
   Production: PostgreSQL on Railway
   ```

2. **Use CI/CD for Production**
   - Git push → GitHub → Actions → Railway
   - Automatic, safe, reversible

3. **Regular Backups**
   - Enable Railway automated backups
   - Take manual snapshots before major changes

4. **Test Migrations Locally First**
   ```bash
   # Make schema change locally
   npx prisma migrate dev --name your_migration_name
   # Test it locally
   # Commit and push
   # Railway handles production deployment
   ```

5. **Review All Schema Changes**
   - Always review `.prisma` file changes in PR
   - Check migration file content
   - Ensure no data loss

### Database Layers

```
┌─────────────────────────────────────┐
│ Layer 1: npm script validation       │
│ (scripts/validate-db-connection.js) │
│ ✅ Checks connection before running  │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│ Layer 2: Environment variables      │
│ (.env - keeps prod DB isolated)     │
│ ✅ Only has prod URL in production  │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│ Layer 3: Prisma Client               │
│ ✅ Only connects to DB in .env      │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│ Layer 4: Railway Access Controls    │
│ ✅ Can set read-only roles per user │
└─────────────────────────────────────┘
```

### What To Do If Something Goes Wrong

1. **Migrations won't apply?**
   ```bash
   npx prisma migrate status  # See what's pending
   npx prisma migrate resolve # Resolve conflicts
   ```

2. **Data lost?**
   - Check Railway backups
   - Contact Railway support for restore

3. **Schema out of sync?**
   ```bash
   npx prisma db push        # Update schema (careful!)
   npx prisma migrate deploy # Apply pending migrations
   ```

### Summary

| Task | Local ✅ | Production ❌ |
|------|---------|----------|
| `npm run db:reset` | Safe | BLOCKED |
| `npm run prisma:migrate` | Safe | BLOCKED |
| `npm run db:push` | Safe | BLOCKED |
| Schema changes | Make locally, test, commit | Deploy via GitHub |
| Production migrations | NEVER | Railway CI/CD only |

---

**Questions?** Check this file or ask before running any `npm run db:*` command on production.
