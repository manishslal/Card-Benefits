# MONITORING SETUP - Production

**Card Benefits Tracker** | Comprehensive Monitoring Configuration  
**Target**: Railway Production Environment  
**Setup Time**: 30-45 minutes  

---

## 📊 MONITORING OVERVIEW

The Card Benefits Tracker uses a multi-layered monitoring approach:

1. **Built-in Railway Monitoring** (Included)
2. **External Uptime Monitoring** (Recommended)
3. **Error Tracking** (Optional: Sentry)
4. **APM & Performance** (Optional: New Relic/DataDog)
5. **Logs & Debugging** (Railway Logs)

---

## 🔧 LAYER 1: RAILWAY BUILT-IN MONITORING

### What's Included (No Setup Needed)

✅ **Metrics Dashboard**:
- CPU usage (%)
- Memory usage (MB)
- Network I/O (bytes)
- Request count
- Response time
- Error rate

✅ **Health Checks**:
- Endpoint: `/api/health`
- Frequency: Every 30 seconds
- Status: Passing/Failing
- Auto-restart on 3 consecutive failures

✅ **Logs**:
- All console output captured
- Real-time streaming
- Searchable/filterable
- 7-day retention

✅ **Deployment Tracking**:
- Build logs
- Deployment history
- Rollback capability
- Status per deployment

### How to Access

```
https://railway.app
  ↓
Select project
  ↓
Choose tab:
  - Metrics: Real-time metrics
  - Logs: Application logs
  - Deployments: Build/deploy history
  - Health Checks: Status checks
  - Variables: Environment variables
```

### Key Metrics to Monitor

| Metric | Normal | Warning | Critical | Action |
|--------|--------|---------|----------|--------|
| CPU | <20% | >50% | >80% | Scale/restart |
| Memory | 100-250MB | >350MB | >450MB | Restart/scale |
| Error Rate | <1% | 1-5% | >5% | Investigate |
| Response Time (p95) | <1s | 1-2s | >2s | Optimize/scale |
| Health Checks | 100% | 1-2 failures | 3+ failures | Auto-restart |
| Request Count | Normal baseline | 2x baseline | 5x baseline | Scale up |

---

## 🌐 LAYER 2: EXTERNAL UPTIME MONITORING

### Why Add External Monitoring?

- Railway dashboard may be unavailable (rare)
- External perspective on availability
- Automated alerts via email/Slack
- Monthly uptime reports
- Historical data beyond 7 days

### Option 1: UptimeRobot (Free Tier)

**Setup (5 minutes)**:

```
1. Go to: https://uptimerobot.com
2. Sign up (free tier available)
3. Click "Add Monitor"
4. Configuration:
   - Monitor Type: HTTP(s)
   - URL: https://card-benefits-production.up.railway.app/api/health
   - Check Interval: 5 minutes
   - Timeout: 30 seconds
   - Name: "Card Benefits Health"

5. Add Alert Contacts:
   - Email: [your-email]
   - Slack: [optional, requires integration]
   
6. Confirm and save
```

**What You Get**:
- ✅ Check every 5 minutes
- ✅ Email alerts on down
- ✅ 99.9% uptime SLA
- ✅ Monthly reports
- ✅ Free tier: 50 monitors, email alerts

**Alert Configuration**:
```
Threshold: 2 consecutive down checks = alert
Cooldown: Don't re-alert for 30 minutes
Notification: Email (and Slack if configured)
```

### Option 2: StatusCake (Alternative)

```
Similar to UptimeRobot
Website: https://www.statuscake.com
Free tier: 10 monitors
Check interval: 1 minute (free tier)
```

### Option 3: Pingdom (Premium)

```
More advanced features
Website: https://www.pingdom.com
Paid starting at $10/month
Better alerting and reporting
```

### Recommended Setup

For production, use **UptimeRobot** (free tier sufficient):

```
- Monitor: /api/health endpoint
- Interval: 5 minutes
- Alert on: Failure (2 consecutive down)
- Notification: Email + Slack
- Expected: >99.9% uptime
```

---

## 📝 LAYER 3: ERROR TRACKING (OPTIONAL - SENTRY)

### Why Add Error Tracking?

- Aggregate all application errors
- Error grouping and deduplication
- Source map support (see actual code lines)
- User impact tracking
- Notifications for new errors

### Setup Instructions (30 minutes)

**Step 1: Create Sentry Account**

```
1. Go to: https://sentry.io
2. Sign up (free tier available)
3. Verify email
4. Create organization (name: your company)
5. Create project:
   - Platform: Node.js
   - Alert setting: Alert on new issues
```

**Step 2: Get DSN**

```
After creating project:
1. Go to: Settings → Projects → [Your Project]
2. Find: Client Keys (DSN)
3. Copy: The DSN URL
   Format: https://[key]@sentry.io/[project-id]
```

**Step 3: Add to Railway**

```
1. Railway Dashboard → Variables
2. Add new variable:
   - Name: SENTRY_DSN
   - Value: [Paste DSN from step 2]
3. Save
4. Redeploy: Deployments → Current → Redeploy
```

**Step 4: Verify Setup**

```bash
# Test error tracking
curl https://card-benefits-production.up.railway.app/api/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test","password":"test"}'

# Should show validation error
# Check Sentry dashboard after 1-2 minutes
# Should see new error group
```

### Sentry Configuration

**Dashboard**:
- Issues: List all errors with frequency
- Trends: Error rate over time
- Performance: Transaction monitoring
- Releases: Track errors by deployment

**Key Features**:
```
- Error grouping: Group similar errors
- Release tracking: Tie errors to specific deployments
- Source maps: See actual code (not minified)
- Breadcrumbs: See events leading to error
- User identification: Know which users affected
```

**Alerts**:
```
1. Go to: Settings → Alerts
2. Create new alert:
   - Condition: New issue created
   - Action: Email + Slack
   - Frequency: Immediate
3. For error threshold:
   - Condition: Error count exceeds 10 in 5 min
   - Action: Email
```

### Using Sentry

```
# View errors
Sentry Dashboard → Issues tab
→ See all unique error groups
→ Sort by: Frequency, date, etc.

# Investigate error
Click on error group
→ See: Stack trace, affected users, timeline
→ Link to: GitHub commit that caused it
→ Resolve: Mark as fixed once deployed

# Monitor health
Issues tab → Frequency graph
→ Should see low error count
→ Spikes indicate problems
```

---

## 📈 LAYER 4: APM & PERFORMANCE (OPTIONAL)

### Option 1: New Relic (Premium)

```
Website: https://newrelic.com
Free tier: Limited
Paid: Starting $99/month

Features:
- Real-time performance monitoring
- Database query analysis
- Error tracking
- Alerts and dashboards
- Browser monitoring (frontend performance)
```

**Setup (if using)**:

```bash
# 1. Create account and project
# 2. Get license key from dashboard

# 3. Add to Railway
# Variables → Add:
# NEW_RELIC_LICENSE_KEY=<your-key>
# NEW_RELIC_APP_NAME=card-benefits

# 4. Install in code (if not already)
npm install newrelic

# 5. Redeploy
```

### Option 2: DataDog (Premium)

```
Website: https://www.datadoghq.com
Free trial: Available
Paid: Starting $15/host/month

Features:
- APM (application performance)
- Infrastructure monitoring
- Log aggregation
- Alerts and dashboards
```

### Recommendation

For MVP/startup: **Skip paid APM**, use Railway metrics + Sentry

For production/mature: Add New Relic or DataDog for deep insights

---

## 📊 LAYER 5: LOG AGGREGATION

### Built-in Railway Logs

Railway includes log storage and searching. To use:

```
1. Railway Dashboard → Logs tab
2. Real-time viewing of console output
3. Search by text: type keyword
4. Filter by date range
5. Retention: 7 days

Useful searches:
- "ERROR" → All error messages
- "auth" → Authentication related
- "/api/health" → Health check requests
- "DATABASE" → Database related
```

### Optional: External Log Aggregation

For longer retention (beyond 7 days):

**Option 1: Datadog Logs**
```
Setup: In New Relic or DataDog dashboard
Retention: 30 days (paid)
Cost: Usually included with APM
```

**Option 2: LogRocket** (For frontend)
```
Website: https://logrocket.com
Focus: Frontend errors and user sessions
Retention: 30 days free tier
```

### Recommended Log Strategy

**Immediate (Free)**:
- Use Railway logs for investigation
- Keep local copies of critical errors
- Monitor daily for patterns

**Future (Paid)**:
- Add log aggregation if keeping 30+ day history needed
- Usually part of APM packages

---

## 🚨 ALERTS SETUP

### Alert Destinations

**Email Alerts**:
```
- UptimeRobot: Downtime alerts
- Sentry: New error threshold
- Railway: Can email on failures (if configured)
```

**Slack Alerts (Recommended)**:
```
1. Create Slack channel: #card-benefits-alerts
2. Set alert channels in each service:
   - UptimeRobot: Slack integration
   - Sentry: Slack integration
   - Railway: Slack integration (if available)
```

**How to Add Slack to Services**:

```
UptimeRobot + Slack:
1. Slack workspace → Settings
2. App Directory → Search "UptimeRobot"
3. Click Add → Authorize
4. Choose channel: #card-benefits-alerts
5. UptimeRobot dashboard → Alerts → Slack

Sentry + Slack:
1. Sentry → Settings → Integrations
2. Search "Slack" → Click
3. Authorize Sentry app in Slack
4. Select channel: #card-benefits-alerts
5. Sentry → Settings → Alerts → Slack
```

### Alert Thresholds

| Alert | Threshold | Notification | Action |
|-------|-----------|--------------|--------|
| Downtime | 2 consecutive fails (10 min) | Email + Slack | Investigate immediately |
| High Error Rate | >5% errors in 5 min | Slack | Investigate |
| Performance | p95 response > 3s | Slack | Monitor, scale if needed |
| Memory | >400MB | Email | Restart or scale |
| CPU | >80% | Email | Scale up |

---

## 📋 MONITORING CHECKLIST

### Daily (Start of Shift)

- [ ] Check Railway dashboard
  - [ ] Health checks passing
  - [ ] CPU <20% (idle)
  - [ ] Memory <300MB
  - [ ] Error rate <1%
- [ ] Review overnight logs
  - [ ] Filter "ERROR" → any issues?
  - [ ] Check last 100 lines → everything normal?
- [ ] Verify uptime monitor
  - [ ] UptimeRobot shows green (100%)
  - [ ] No downtime alerts

### Weekly

- [ ] Review error trends
  - [ ] Sentry dashboard → Issues
  - [ ] Any new error patterns?
  - [ ] Resolve fixed issues
- [ ] Check performance trends
  - [ ] Response time stable?
  - [ ] CPU/memory stable?
  - [ ] Any concerning patterns?
- [ ] Backup validation
  - [ ] PostgreSQL backups running?
  - [ ] Backup size reasonable?

### Monthly

- [ ] Full metrics review
  - [ ] Generate report: CPU, memory, errors
  - [ ] Uptime percentage (goal: >99.9%)
  - [ ] Peak usage times and patterns
- [ ] Capacity planning
  - [ ] Are we approaching limits?
  - [ ] Do we need to scale?
  - [ ] Forecast for next month
- [ ] Security review
  - [ ] Any suspicious requests?
  - [ ] Failed auth attempts normal?
  - [ ] Any configuration drift?

---

## 🔧 TROUBLESHOOTING MONITORING

### "Not Seeing UptimeRobot Alerts"

```
1. Verify monitor is running:
   UptimeRobot → Monitors → Status should be green
   
2. Test alert:
   Manually trigger: Temporarily down endpoint
   Should receive alert within 5 minutes
   
3. Check Slack integration:
   UptimeRobot → Integrations → Slack
   Verify: Channel configured, permissions granted
```

### "Sentry Not Capturing Errors"

```
1. Verify DSN set:
   Railway → Variables → SENTRY_DSN should exist
   
2. Redeploy:
   Deployments → Current → Redeploy
   (Some env vars only loaded at startup)
   
3. Test error:
   curl /api/auth/login with invalid data
   Wait 1-2 minutes
   Check Sentry dashboard
```

### "Railway Metrics Not Showing"

```
1. Wait 5 minutes after deployment
   Metrics take time to populate
   
2. Verify app is running:
   curl /api/health → Should return 200
   
3. Check project status:
   Railway dashboard → Deployments
   Should show green checkmark
```

---

## 📞 ESCALATION

**If Monitoring System Down**:
- Railway can be monitored from UptimeRobot dashboard
- UptimeRobot failing? Check Slack #alerts manually
- Can't see metrics? Check Railway status page directly

**If Multiple Alerts Firing**:
- Sign into Railway directly (https://railway.app)
- Check app health and logs
- Follow incident response procedures

---

## ✅ SETUP SUMMARY

**Minimum (Free)**:
- ✅ Railway metrics (built-in)
- ✅ Railway logs (built-in)
- ✅ Health checks (built-in)
- ✅ UptimeRobot (free tier)

**Recommended (Free + Optional)**:
- ✅ Everything above
- ✅ Sentry error tracking (free tier)
- ✅ Slack alerts (free with Slack workspace)

**Advanced (Paid)**:
- ✅ Everything above
- + New Relic or DataDog APM
- + 30-day log retention
- + Custom dashboards

---

**Monitoring Setup Complete** ✅

Next Steps:
1. Set up UptimeRobot (5 min)
2. (Optional) Set up Sentry (15 min)
3. (Optional) Configure Slack alerts (10 min)
4. Monitor during first 24 hours after deployment
5. Adjust thresholds based on actual metrics
