# Cron Job Setup for Railway (Alternative Solutions)

Your application has a `/api/cron/reset-benefits` endpoint that runs daily to reset expired benefits.

The current setup uses `vercel.json` which is **Vercel-specific and won't work on Railway**.

---

## 🎯 Recommended Solution for MVP: External Scheduler

**Best for:** Getting to market quickly without complexity  
**Effort:** 15 minutes  
**Cost:** $0-5/month

### Option 1: Easycron (RECOMMENDED)

Easycron is a free external cron job service that calls your endpoint daily.

#### Step 1: Create Cron Job in Easycron
1. Go to https://www.easycron.com
2. Sign up (free tier allows 1 cron job)
3. Click "Create"
4. Fill in:
   - **Cron Expression:** `0 0 * * *` (daily at midnight UTC)
   - **URL:** `https://your-app.railway.app/api/cron/reset-benefits`
   - **Method:** GET
   - **Header:** Add custom header:
     - Name: `Authorization`
     - Value: `Bearer YOUR_CRON_SECRET_HERE`
5. Click "Create"
6. Test by clicking "Run Now"
7. Check logs: Should return 200 OK with reset summary

#### Step 2: Verify on Railway
1. Go to Railway dashboard
2. Click on your app
3. Go to "Logs" tab
4. Search for "reset-benefits" 
5. Should see: `[CRON] Successfully reset X benefits`

#### Advantages
- ✅ Free (up to 1 cron job)
- ✅ No additional infrastructure
- ✅ Simple setup (5 minutes)
- ✅ Works across instances
- ✅ No single point of failure

#### Disadvantages
- ⚠️ External dependency
- ⚠️ Small delay if Easycron is down (rare)

---

### Option 2: AWS EventBridge

For teams already using AWS.

#### Step 1: Create EventBridge Rule
```bash
aws events put-rule \
  --name card-benefits-reset \
  --schedule-expression "cron(0 0 * * ? *)" \
  --state ENABLED
```

#### Step 2: Create HTTP Target
```bash
aws events put-targets \
  --rule card-benefits-reset \
  --targets "Id"="1","HttpParameters"={"HeaderParameters":{"Authorization":"Bearer YOUR_CRON_SECRET"}},"RoleArn"="arn:aws:iam::ACCOUNT_ID:role/EventBridgeRole","Arn"="https://your-app.railway.app/api/cron/reset-benefits"
```

#### Cost
- Free tier: 10 million events/month
- Your app: 1 event/day = 30 events/month ✅ Free

---

### Option 3: Google Cloud Scheduler

For teams using Google Cloud.

#### Step 1: Create Scheduler Job
```bash
gcloud scheduler jobs create http card-benefits-reset \
  --location=us-central1 \
  --schedule="0 0 * * *" \
  --uri="https://your-app.railway.app/api/cron/reset-benefits" \
  --http-method=GET \
  --headers="Authorization=Bearer YOUR_CRON_SECRET"
```

#### Cost
- Free tier: 3 jobs, unlimited executions
- Your app: 1 job ✅ Free

---

## 🔧 Alternative: Railway Native Worker

**Best for:** Fully integrated solution (post-MVP)  
**Effort:** 2-3 days  
**Cost:** +$5-10/month for worker service

Instead of external scheduler, deploy separate worker service that runs cron job.

### Setup

#### Step 1: Create Worker Service
```typescript
// src/worker.ts
import { prisma } from '@/lib/prisma';

async function runCronJob() {
  console.log('[WORKER] Starting benefit reset job');
  
  try {
    const resetResult = await prisma.$transaction(async (tx) => {
      const expiredBenefits = await tx.userBenefit.findMany({
        where: {
          isUsed: true,
          expirationDate: { lte: new Date() },
          userCard: {
            masterCard: {
              masterBenefit: {
                resetCadence: { not: 'OneTime' },
              },
            },
          },
        },
      });

      // Reset logic here...
      return { reset: expiredBenefits.length };
    });

    console.log('[WORKER] Job completed:', resetResult);
  } catch (error) {
    console.error('[WORKER] Job failed:', error);
    process.exit(1); // Railway will restart
  }
}

// Run job every 24 hours
setInterval(runCronJob, 24 * 60 * 60 * 1000);

// Run immediately on startup
runCronJob();
```

#### Step 2: Create Worker Service in Railway
1. Create new service in Railway project
2. Link same GitHub repo
3. Set start command: `node src/worker.ts`
4. Set 1 replica (no need for multiple)
5. Same environment variables (DATABASE_URL, etc.)

#### Advantages
- ✅ Fully integrated
- ✅ No external dependencies
- ✅ Better error handling
- ✅ Can use shared database

#### Disadvantages
- ⚠️ More complex setup
- ⚠️ Extra cost
- ⚠️ Takes longer to implement

---

## 📋 Current Endpoint Details

### Endpoint: `/api/cron/reset-benefits`

**Location:** `src/app/api/cron/reset-benefits/route.ts`  
**Method:** GET  
**Security:** CRON_SECRET verification (timing-safe)  
**Rate Limit:** 10 requests/hour per IP  

### What It Does
1. **Validates CRON_SECRET** from Authorization header
2. **Finds expired benefits:**
   ```sql
   WHERE isUsed = true
     AND expirationDate <= NOW()
     AND resetCadence != 'OneTime'
   ```
3. **Resets each benefit:**
   - isUsed = false
   - claimedAt = null
   - timesUsed = 0
   - expirationDate = nextExpirationDate

4. **Returns summary:**
   ```json
   {
     "success": true,
     "resetsApplied": 42,
     "jobDuration": "234ms"
   }
   ```

### Example Call
```bash
CRON_SECRET=$(openssl rand -hex 32)

curl -X GET https://your-app.railway.app/api/cron/reset-benefits \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json"

# Response (200 OK):
# {
#   "success": true,
#   "resetsApplied": 42,
#   "jobDuration": "234ms",
#   "timestamp": "2025-01-15T00:00:00.000Z"
# }
```

---

## 🚀 Implementation Steps

### Step 1: Test Current Endpoint Locally
```bash
npm run dev &

# In another terminal:
CRON_SECRET="6d3f7e8c2b9a1d4f5e6c7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c"

curl -X GET http://localhost:3000/api/cron/reset-benefits \
  -H "Authorization: Bearer $CRON_SECRET"

# Expected:
# {
#   "success": true,
#   "resetsApplied": 0,
#   "jobDuration": "23ms"
# }
```

### Step 2: Deploy to Railway
1. Push code to main branch
2. Railway automatically deploys
3. Verify health check: `curl https://your-app.railway.app/api/health`
4. Test endpoint: See step 1, replace localhost with railway domain

### Step 3: Setup Easycron
1. Go to https://www.easycron.com
2. Create new cron job
3. Set URL: `https://your-app.railway.app/api/cron/reset-benefits`
4. Add header: `Authorization: Bearer YOUR_CRON_SECRET`
5. Test: Click "Run Now"
6. Verify: Check Railway logs for success message

### Step 4: Monitor First Run
1. Railway dashboard → Logs
2. Look for entry: `[CRON] Received request`
3. Verify: `[CRON] Successfully reset X benefits`
4. Check database: Benefits should be reset

---

## 🔍 Troubleshooting

### Cron Job Not Running

**Check 1: Easycron Status**
- Go to https://www.easycron.com/cron-jobs
- Look for your job
- Click "View logs"
- Should show "HTTP status: 200"

**Check 2: Endpoint is Reachable**
```bash
curl -I https://your-app.railway.app/api/health
# Should return: HTTP/2 200
```

**Check 3: Authorization Header**
```bash
curl -v -X GET https://your-app.railway.app/api/cron/reset-benefits \
  -H "Authorization: Bearer INVALID_SECRET"
# Should return: 401 Unauthorized
```

**Check 4: Railway Logs**
- Railway dashboard → Logs
- Search for "reset-benefits"
- Should see request log entry

### Still Not Working?

1. **Verify CRON_SECRET is set correctly**
   ```bash
   # Check it's in .env.local locally
   grep CRON_SECRET .env.local
   
   # Check it's set in Railway
   # Railway Dashboard → Environment
   # Should see CRON_SECRET with value
   ```

2. **Check endpoint manually**
   ```bash
   curl -X GET https://your-app.railway.app/api/cron/reset-benefits \
     -H "Authorization: Bearer $CRON_SECRET" \
     -v
   ```

3. **Check logs for errors**
   ```
   Railway Dashboard → Logs
   Search for: "ERROR\|WARN\|reset-benefits"
   ```

4. **Test database access**
   ```
   Check if database is connected:
   curl https://your-app.railway.app/api/health
   Should return: { "database": "connected" }
   ```

---

## ⚡ Performance Notes

### Current Implementation
- **Duration:** 200-500ms for typical reset
- **Database Load:** 1-2 queries per benefit
- **Transactions:** Atomic (all-or-nothing)

### Scaling Considerations
If you grow to 100,000+ benefits:

**Recommendation:** Optimize with batching
```typescript
// Current: Update one by one
// Change to: Batch update all at once

await prisma.userBenefit.updateMany({
  where: {
    isUsed: true,
    expirationDate: { lte: new Date() },
    userCard: { /* filter */ }
  },
  data: {
    isUsed: false,
    claimedAt: null,
    timesUsed: 0,
  }
});
```

This reduces 1000 queries → 1 query!

---

## 📊 Monitoring

### Add Alert for Failed Cron Jobs

**Using Sentry (recommended):**

```typescript
// src/app/api/cron/reset-benefits/route.ts
import * as Sentry from "@sentry/nextjs";

export async function GET(request: NextRequest) {
  try {
    // ... cron logic
    Sentry.captureMessage('Cron job completed', 'info', {
      tags: { cron_job: 'reset-benefits' }
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { cron_job: 'reset-benefits' }
    });
    // Return 500 to alert scheduler
    return NextResponse.json(
      { error: 'Cron job failed' },
      { status: 500 }
    );
  }
}
```

### Manual Monitoring

Check Railway logs daily:
```bash
# SSH into Railway app
railway exec logs | grep "reset-benefits"

# Should see entries like:
# [CRON] Received request from 123.45.67.89
# [CRON] Successfully reset 42 benefits
# [CRON] Job duration: 234ms
```

---

## 🎓 Post-Launch: Better Solution (Phase 2)

Once MVP is live and stable, consider:

1. **Switch to Railway Native Worker**
   - Deploy separate worker service
   - Runs in same cluster
   - No external dependencies
   - Cost: +$5/month

2. **Add Job Queue (Bull + Redis)**
   - More reliable than HTTP polling
   - Better error handling
   - Automatic retries
   - Cost: +$10-15/month for Redis

3. **Database Triggers**
   - PostgreSQL triggers reset benefits
   - No external scheduler needed
   - Complex but elegant solution
   - Cost: None (database cost)

For MVP, **Easycron is perfect**: simple, free, reliable.

---

## ✅ Success Criteria

After setting up Easycron:

- [ ] Cron job created in Easycron
- [ ] Authorization header set with CRON_SECRET
- [ ] Test run shows HTTP 200
- [ ] Railway logs show job execution
- [ ] Benefits table updated correctly
- [ ] No errors in past 24 hours

---

**Need help? Check DEPLOYMENT_READINESS_AUDIT.md section "Cron Jobs & Background Tasks" for more details.**
