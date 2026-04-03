# Card Benefits Tracker - Email Alerts System Specification

## Executive Summary

This specification defines a comprehensive email notification system for the Card Benefits Tracker. Users receive timely, configurable alerts about benefit expirations, card renewals, and optimization opportunities. The system balances proactive notifications with user preferences, preventing alert fatigue while ensuring critical information reaches users.

**Primary Objectives:**
- Send expiration alerts before benefits expire
- Remind users of card renewal and annual fee due dates
- Identify optimization opportunities (unused benefits, low ROI)
- Provide configurable alert preferences (frequency, types, timing)
- Enable unsubscribe and preference management
- Build audit trail of all sent alerts

---

## Functional Requirements

### Alert Types

#### FR1: Benefit Expiration Alerts
- Alert when benefit expires in X days (configurable: 3, 7, 14, 30 days)
- Show benefit name, expiration date, current value
- Provide quick link to claim benefit if unclaimed
- Include card name and issuer for context
- One alert per benefit (no duplicates)
- Do not alert for expired benefits (after expiration)

#### FR2: Card Renewal Alerts
- Alert when card renewal date approaches (configurable: 7, 14, 30 days)
- Show renewal date and annual fee
- Show benefits that will reset on renewal
- Provide link to edit renewal date if incorrect
- One alert per card per renewal cycle
- Do not re-alert if already sent

#### FR3: Annual Fee Due Alerts
- Alert when annual fee is due within X days (configurable: 7, 14, 30 days)
- Show card name, issuer, annual fee amount
- Link to check if benefit value justifies fee
- Combined with renewal alert if both due
- One alert per card per cycle

#### FR4: Optimization Alerts
- Identify benefits unused for 90+ days
- Suggest canceling cards with low ROI (< 10% or < $50/year)
- Alert when benefits are expiring unclaimed
- Recommend adjusting benefit values based on actual usage
- Optional: AI-powered suggestions

#### FR5: Weekly/Monthly Digest
- Optional digest email summarizing wallet status
- Expiring benefits summary
- Renewal dates approaching
- Overall wallet ROI and trends
- Unused benefits and low-ROI cards
- Recommended actions

### Preference Management

#### FR6: Alert Preference UI
- Settings page for notification preferences
- Toggle individual alert types on/off
- Set timing for each alert (days before event)
- Email frequency options:
  - Immediately
  - Daily digest
  - Weekly digest
  - Monthly digest
  - Never
- Per-alert-type preferences (e.g., receive renewal alerts but not optimization)

#### FR7: Global Unsubscribe
- One-click unsubscribe from all emails
- Link in every email footer
- Verify unsubscribe (prevent accidental opt-out)
- Re-subscribe option from settings
- Respect CAN-SPAM and GDPR requirements

#### FR8: Smart Alert Batching
- Combine multiple alerts into single email if sent on same day
- Avoid alert fatigue: max 1 email per day per user
- Batch related alerts: all expiring benefits in one section
- Summarize: "5 benefits expiring this week" vs individual emails

#### FR9: Timezone Awareness
- Respect user's timezone for alert timing
- Calculate expiration dates in user's timezone
- Send alerts at user-specified time (if configurable)
- Handle DST transitions correctly

#### FR10: Notification In-App
- Optional: in-app bell notification for alert
- Show alert count on dashboard
- Alert center view (list of recent alerts)
- Mark alerts as read

### Email Delivery & Content

#### FR11: Email Templates
- Professional, branded email design
- Mobile-responsive HTML
- Clear call-to-action buttons
- Benefit summary table
- Footer with: preferences link, unsubscribe, contact
- Dark mode compatible

#### FR12: Dynamic Content
- Personalized greeting with user's name
- Card-specific content (show affected cards only)
- Benefit-specific content (list actual benefits)
- Calculated values (custom declared values if set)
- ROI calculations (show impact)

#### FR13: Delivery Reliability
- Retry on failure (exponential backoff)
- Track delivery status (sent, bounced, opened)
- Handle hard bounces (disable account)
- Handle soft bounces (retry later)
- Implement rate limiting (avoid spam)

#### FR14: Email Logging & Audit Trail
- Log all sent emails (template, recipient, timestamp)
- Track delivery status (pending, sent, bounced, failed)
- Store email content for reference
- Enable resend if delivery failed
- Privacy: store minimal PII

### Scheduling & Delivery

#### FR15: Smart Scheduling
- Send alerts at optimal times (morning, weekday bias)
- Avoid sending too late at night
- Batch related alerts into single email
- Stagger deliveries to avoid thundering herd
- Respect user's timezone

#### FR16: Cron Job Management
- Daily job: check for expiring benefits
- Daily job: check for renewal dates
- Weekly job: generate digest emails
- Secure cron endpoint (prevent timing attacks)
- Idempotent: no duplicate alerts if run twice

#### FR17: Alert History
- View previously sent alerts
- Resend alert if needed
- Dismiss/archive alerts
- Filter by type and date range

---

## Critical Amendments - QA Issue Resolution

### Amendment #3: Timezone & DST Handling - Email Alerts Specific

**Reference:** See SPEC_PHASE4_SECURITY_AMENDMENTS.md Section 3 for complete timezone specification.

**Email Alerts Integration:**

#### Alert Scheduling Respects Timezone

All alert times MUST be scheduled using user's email preference timezone:

```typescript
async function scheduleAlertForUser(
  alert: AlertSchedule,
  user: User,
  userEmailPref: UserEmailPreferences
): Promise<void> {
  // Get user's timezone for email alerts (may differ from login timezone)
  const timezone = userEmailPref.timezone; // e.g., "America/New_York"

  // Calculate when alert should send in user's timezone
  // Example: "Send benefit expiration alert 7 days before, at 9 AM user's time"
  const scheduledTime = calculateAlertTime(alert, timezone);

  // Convert to UTC for storage
  const utcScheduledTime = convertToUTC(scheduledTime, timezone);

  // Store with timezone info for audit
  await db.scheduledAlert.create({
    data: {
      userId: user.id,
      alertType: alert.type,
      scheduledAtUTC: utcScheduledTime,
      userTimezone: timezone,  // Store original timezone
      ...
    }
  });
}
```

#### DST Transition Alerts

When DST transition occurs:
1. Find all scheduled alerts in affected timezone
2. For each alert, check if scheduled time exists
3. If time doesn't exist (spring forward):
   - Move alert to next valid time
   - Log adjustment
   - User receives alert at adjusted time (transparent to them)
4. If time is ambiguous (fall back):
   - Use first occurrence (before transition)
   - Log which occurrence used

**Example with Amendment #8 state machine:**
```
Alert scheduled: 2024-03-10 02:30:00 EST (America/New_York)
DST transition: 2024-03-10 02:00:00 EST → 03:00:00 EDT
Available times: ..., 2:00 AM EST, 3:00 AM EDT, 4:00 AM EDT, ...

Action:
  Original 2:30 AM doesn't exist
  → Schedule for 3:00 AM EDT instead
  → Log: "Adjusted for DST forward transition"
  → User gets alert at 3 AM (same as they would have)
```

#### Timezone Change Alert Recalculation

When user changes `UserEmailPreferences.timezone`:
1. Find all pending scheduled alerts for that user
2. For each alert:
   - Convert scheduled time from old TZ to UTC
   - Re-interpret in new timezone
   - Update scheduled time
3. Send confirmation email showing new alert times

**Example:**
```
User changes from "America/New_York" to "Europe/London"

Alert was: 2024-04-15 9:00 AM EDT = 2024-04-15 13:00 UTC
Alert now: 2024-04-15 2:00 PM BST (same UTC instant)

Email to user:
  "Your timezone has changed to London.
   Alert that was at 9:00 AM EDT will now arrive at 2:00 PM BST."
```

#### DST Test Cases for Email Alerts

```gherkin
Scenario: Spring Forward Transition (Mar 10, 2024)
  Given user in "America/New_York" with alert at 2:30 AM
  When DST transition occurs (2:00 AM EST → 3:00 AM EDT)
  Then alert is scheduled for 3:00 AM EDT
  And log shows: "Adjusted for DST forward"
  And user receives email at 3:00 AM EDT

Scenario: Fall Back Transition (Nov 3, 2024)
  Given user in "America/New_York" with alert at 1:30 AM
  When DST transition occurs (1:00 AM EDT → 1:00 AM EST)
  Then alert is scheduled for 1:30 AM EDT (first occurrence)
  And log shows: "Using first occurrence (EDT)"
  And user receives email at 1:30 AM EDT

Scenario: Timezone Change with Pending Alerts
  Given user changes timezone from "America/New_York" to "Europe/London"
  And user has pending alert: "2024-04-15 9:00 AM EDT"
  When timezone update is processed
  Then alert is rescheduled to "2024-04-15 2:00 PM BST"
  And user receives confirmation email
  And alert timestamp in database: "2024-04-15T13:00:00Z" (unchanged UTC)
```

---

### Amendment #4: Unsubscribe Token Security

#### Secure Token Generation & Verification

**Token Format: 32-byte random + HMAC signature**

```typescript
import crypto from 'crypto';

const TOKEN_EXPIRATION_HOURS = 30 * 24;  // 30 days
const TOKEN_SECRET = process.env.UNSUBSCRIBE_TOKEN_SECRET;

function generateUnsubscribeToken(userId: string): {
  token: string;
  expiresAt: Date;
} {
  // Generate 32 random bytes
  const randomBytes = crypto.randomBytes(32).toString('hex');

  // Create expiration timestamp
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + TOKEN_EXPIRATION_HOURS);

  // Create signature to prevent token tampering
  const signature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(`${userId}:${randomBytes}:${expiresAt.toISOString()}`)
    .digest('hex');

  // Token format: randomBytes.expiresAtTimestamp.signature
  const token = `${randomBytes}.${expiresAt.getTime()}.${signature}`;

  return { token, expiresAt };
}

function verifyUnsubscribeToken(
  userId: string,
  token: string
): { valid: boolean; error?: string } {
  try {
    // Parse token components
    const [randomBytes, expiresAtMs, providedSignature] = token.split('.');

    if (!randomBytes || !expiresAtMs || !providedSignature) {
      return { valid: false, error: 'INVALID_TOKEN_FORMAT' };
    }

    // Check expiration
    const expiresAt = new Date(parseInt(expiresAtMs, 10));
    if (new Date() > expiresAt) {
      return { valid: false, error: 'TOKEN_EXPIRED' };
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', TOKEN_SECRET)
      .update(`${userId}:${randomBytes}:${expiresAt.toISOString()}`)
      .digest('hex');

    // Use constant-time comparison to prevent timing attacks
    const signatureMatch = crypto.timingSafeEqual(
      Buffer.from(providedSignature),
      Buffer.from(expectedSignature)
    );

    if (!signatureMatch) {
      return { valid: false, error: 'INVALID_SIGNATURE' };
    }

    return { valid: true };

  } catch (error) {
    return { valid: false, error: 'TOKEN_VERIFICATION_FAILED' };
  }
}
```

#### Token Expiration & Reusability

**Requirement: Unsubscribe tokens are SINGLE-USE and TIME-LIMITED**

```typescript
// Token table
UnsubscribeToken {
  id: String @id
  userId: String
  token: String @unique
  expiresAt: DateTime
  usedAt: DateTime?           // Null until used
  usedFromIP: String?         // For audit trail
  invalidatedAt: DateTime?    // Manually invalidated

  createdAt: DateTime @default(now())
}

async function processUnsubscribe(
  token: string,
  userAgent: string,
  ipAddress: string
): Promise<{ success: boolean; error?: string }> {
  // Verify token signature and expiration
  const tokenRecord = await db.unsubscribeToken.findUnique({
    where: { token }
  });

  if (!tokenRecord) {
    return { success: false, error: 'INVALID_TOKEN' };
  }

  // Check if token was already used
  if (tokenRecord.usedAt) {
    // Log suspicious activity (token reuse attempt)
    await logSecurityEvent('UNSUBSCRIBE_TOKEN_REUSE_ATTEMPT', {
      userId: tokenRecord.userId,
      token: token.substring(0, 10) + '...',  // Don't log full token
      ipAddress,
      userAgent,
      previousUsedAt: tokenRecord.usedAt
    });

    return { success: false, error: 'TOKEN_ALREADY_USED' };
  }

  // Check expiration
  if (new Date() > tokenRecord.expiresAt) {
    return { success: false, error: 'TOKEN_EXPIRED' };
  }

  // Mark token as used (atomic)
  await db.unsubscribeToken.update({
    where: { id: tokenRecord.id },
    data: {
      usedAt: new Date(),
      usedFromIP: ipAddress
    }
  });

  // Update user preferences
  await db.userEmailPreferences.update({
    where: { userId: tokenRecord.userId },
    data: {
      allAlertsDisabled: true,
      unsubscribedAt: new Date()
    }
  });

  return { success: true };
}
```

#### CSRF Protection for Unsubscribe Endpoint

**Requirement: POST endpoint with CSRF token, not GET-only link**

```typescript
// Email template - CSRF-protected form
// (Don't use GET link: attacker could trick user into clicking)

const unsubscribeTemplate = `
<html>
  <body>
    <p>To unsubscribe from all Card Benefits alerts:</p>

    <!-- HTML form with CSRF protection -->
    <form method="POST" action="https://app.example.com/api/alerts/unsubscribe">
      <input type="hidden" name="token" value="${unsubscribeToken}" />
      <input type="hidden" name="csrf_token" value="${csrfToken}" />
      <button type="submit">Unsubscribe</button>
    </form>

    <p>Or click the link below (browser session required):</p>
    <a href="https://app.example.com/alerts/unsubscribe?token=${unsubscribeToken}">
      https://app.example.com/alerts/unsubscribe?token=${unsubscribeToken}
    </a>
  </body>
</html>
`;

// Endpoint implementation
async function handleUnsubscribe(
  req: Request,
  res: Response
): Promise<Response> {
  if (req.method === 'POST') {
    // POST: Verify CSRF token
    const csrfValid = await verifyCsrfToken(req);
    if (!csrfValid) {
      return res.status(403).json({ error: 'CSRF_TOKEN_INVALID' });
    }

    const { token } = req.body;
    const result = await processUnsubscribe(token, req.headers['user-agent'], req.ip);
    return res.json(result);

  } else if (req.method === 'GET') {
    // GET: One-click from email, show confirmation form
    const { token } = req.query;

    // Don't immediately unsubscribe - show confirmation page
    const csrfToken = generateCsrfToken(req);

    return res.send(`
      <html>
        <body>
          <h1>Unsubscribe from Alerts?</h1>
          <p>Click the button below to confirm:</p>

          <form method="POST">
            <input type="hidden" name="token" value="${token}" />
            <input type="hidden" name="csrf_token" value="${csrfToken}" />
            <button type="submit">Yes, unsubscribe me</button>
            <a href="/">Cancel</a>
          </form>
        </body>
      </html>
    `);
  }

  return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
}
```

#### Rate Limiting on Unsubscribe Attempts

**Requirement: Prevent brute force attacks**

```typescript
async function rateLimitUnsubscribeAttempt(
  ipAddress: string,
  userId?: string
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const MAX_ATTEMPTS = 5;
  const WINDOW_MINUTES = 15;

  // Track by IP and optionally by user
  const key = userId ? `unsubscribe:${userId}` : `unsubscribe:ip:${ipAddress}`;

  const attempts = await redis.incr(key);

  // Set expiration on first attempt
  if (attempts === 1) {
    await redis.expire(key, WINDOW_MINUTES * 60);
  }

  if (attempts > MAX_ATTEMPTS) {
    const ttl = await redis.ttl(key);
    return { allowed: false, retryAfter: ttl };
  }

  return { allowed: true };
}

// In unsubscribe endpoint
async function handleUnsubscribe(req: Request, res: Response) {
  // Rate limit check
  const { allowed, retryAfter } = await rateLimitUnsubscribeAttempt(
    req.ip,
    req.user?.id
  );

  if (!allowed) {
    return res.status(429).json({
      error: 'TOO_MANY_ATTEMPTS',
      retryAfterSeconds: retryAfter
    });
  }

  // ... continue with unsubscribe logic
}
```

#### Token Security Storage

**Requirements for storing tokens in database:**

1. Never store plaintext tokens
2. Store only hash of token
3. Use strong hash algorithm

```typescript
import bcrypt from 'bcrypt';

async function storeUnsubscribeToken(
  userId: string,
  plainToken: string,
  expiresAt: Date
): Promise<UnsubscribeToken> {
  // Hash token before storing (one-way hash)
  const hashedToken = await bcrypt.hash(plainToken, 10);

  return await db.unsubscribeToken.create({
    data: {
      userId,
      token: hashedToken,  // Store hash, not plaintext
      expiresAt,
      createdAt: new Date()
    }
  });
}

async function verifyStoredToken(
  plainToken: string,
  storedHash: string
): Promise<boolean> {
  // Compare plaintext with hash (one-way comparison)
  return await bcrypt.compare(plainToken, storedHash);
}
```

#### Security Audit Log

Log all unsubscribe activities:

```typescript
async function logUnsubscribeActivity(
  event: 'TOKEN_GENERATED' | 'TOKEN_USED' | 'TOKEN_REUSE_ATTEMPT' | 'TOKEN_EXPIRED',
  details: {
    userId: string;
    tokenHash: string;  // Hash, not plaintext
    ipAddress: string;
    userAgent: string;
    timestamp: Date;
  }
): Promise<void> {
  await db.auditLog.create({
    data: {
      eventType: 'UNSUBSCRIBE_' + event,
      userId: details.userId,
      description: `Unsubscribe token ${event.toLowerCase()}`,
      details: JSON.stringify({
        tokenHash: details.tokenHash,
        ipAddress: details.ipAddress,
        userAgent: details.userAgent
      }),
      timestamp: details.timestamp,
      severity: event.includes('REUSE') ? 'HIGH' : 'INFO'
    }
  });
}
```

---

### Amendment #10: Email Delivery Testing

#### Test Email Capability

**Requirement: Users can send test alerts to verify delivery**

```typescript
// User preferences UI includes:
// [Send Test Email] button

async function sendTestAlert(
  userId: string,
  alertType: 'BENEFIT_EXPIRATION' | 'CARD_RENEWAL' | 'ALL_ALERTS'
): Promise<{ success: boolean; sentTo: string; error?: string }> {
  // Get user's email and preferences
  const user = await db.user.findUnique({ where: { id: userId } });
  const prefs = await db.userEmailPreferences.findUnique({
    where: { userId }
  });

  if (!user.email) {
    return {
      success: false,
      sentTo: '',
      error: 'No email address on file'
    };
  }

  if (prefs.allAlertsDisabled) {
    return {
      success: false,
      sentTo: user.email,
      error: 'All alerts are disabled for this account'
    };
  }

  try {
    // Generate test alert content
    const testAlert = generateTestAlertContent(user, alertType);

    // Send test email
    const result = await emailService.send({
      to: user.email,
      subject: `[TEST] Card Benefits Alert`,
      html: testAlert.html,
      text: testAlert.text
    });

    // Log test email (separate from regular alerts)
    await db.testAlertLog.create({
      data: {
        userId,
        alertType,
        sentTo: user.email,
        sentAt: new Date(),
        messageId: result.messageId,
        status: 'SENT'
      }
    });

    return {
      success: true,
      sentTo: user.email
    };

  } catch (error) {
    await db.testAlertLog.create({
      data: {
        userId,
        alertType,
        sentTo: user.email,
        sentAt: new Date(),
        status: 'FAILED',
        error: error.message
      }
    });

    return {
      success: false,
      sentTo: user.email,
      error: `Failed to send test email: ${error.message}`
    };
  }
}
```

#### Staging vs. Production Email Configuration

**Requirement: Different email service configuration per environment**

```typescript
// .env files
// .env.development
EMAIL_SERVICE=mailhog              // Local SMTP for testing
EMAIL_FROM=test@localhost:1025
TEST_EMAIL_ENABLED=true
STAGING_MODE=true                 // Show [STAGING] banner in emails

// .env.staging
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=...
EMAIL_FROM=alerts@staging.cardbenefits.com
TEST_EMAIL_ENABLED=true
STAGING_MODE=true

// .env.production
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=...
EMAIL_FROM=alerts@cardbenefits.com
TEST_EMAIL_ENABLED=false           // No test emails in production
STAGING_MODE=false
```

**Email Service Abstraction:**

```typescript
interface EmailService {
  send(options: EmailOptions): Promise<{ messageId: string }>;
  getStatus(messageId: string): Promise<DeliveryStatus>;
  listBounces(): Promise<BounceRecord[]>;
  unsubscribeWebhook(handler: WebhookHandler): void;
}

// Factory to select correct service
function createEmailService(provider: string): EmailService {
  switch (provider) {
    case 'sendgrid':
      return new SendGridService();
    case 'ses':
      return new AWSEmailService();
    case 'mailhog':
      return new LocalMailhogService();
    default:
      throw new Error(`Unknown email service: ${provider}`);
  }
}

export const emailService = createEmailService(
  process.env.EMAIL_SERVICE || 'sendgrid'
);
```

#### Email Validation & Bounce Handling

**Requirement: Track bounces and invalid emails**

```typescript
// Webhook from email service (e.g., SendGrid)
async function handleEmailBounce(event: {
  type: 'bounce' | 'dropped' | 'invalid_email';
  email: string;
  reason: string;
}): Promise<void> {
  // Find user
  const user = await db.user.findUnique({
    where: { email: event.email }
  });

  if (!user) return;  // Unknown user, ignore

  // Record bounce
  await db.emailBounce.create({
    data: {
      userId: user.id,
      email: event.email,
      type: event.type,
      reason: event.reason,
      bouncedAt: new Date()
    }
  });

  // Count bounces for this user
  const bounceCount = await db.emailBounce.count({
    where: {
      userId: user.id,
      bouncedAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)  // Last 30 days
      }
    }
  });

  // Disable alerts after 3 bounces
  if (bounceCount >= 3) {
    await db.userEmailPreferences.update({
      where: { userId: user.id },
      data: {
        allAlertsDisabled: true,
        disabledReason: 'Email bouncing - invalid address'
      }
    });

    // Notify user via in-app alert
    await createInAppAlert(user.id, {
      type: 'EMAIL_DELIVERY_FAILED',
      message: 'Email alerts disabled due to delivery failures. Update your email address to re-enable.'
    });
  }
}
```

#### Delivery Guarantees & Retry Strategy

**Requirement: At-least-once delivery with exponential backoff**

```typescript
// Email delivery with retry logic
async function sendAlertWithRetry(
  alert: Alert,
  maxRetries: number = 3
): Promise<{ delivered: boolean; messageId?: string; error?: string }> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Send email
      const result = await emailService.send({
        to: alert.userEmail,
        subject: alert.subject,
        html: alert.htmlContent,
        text: alert.textContent
      });

      // Log successful send
      await db.sentAlert.create({
        data: {
          userId: alert.userId,
          alertId: alert.id,
          messageId: result.messageId,
          sentAt: new Date(),
          attempt,
          status: 'DELIVERED'
        }
      });

      return { delivered: true, messageId: result.messageId };

    } catch (error) {
      lastError = error;

      // Log failed attempt
      await db.sentAlert.create({
        data: {
          userId: alert.userId,
          alertId: alert.id,
          sentAt: new Date(),
          attempt,
          status: 'FAILED',
          error: error.message
        }
      });

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt - 1) * 1000;  // 1s, 2s, 4s
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  // All retries failed
  return {
    delivered: false,
    error: lastError?.message || 'Unknown error'
  };
}
```

#### Email Templates Testing

**Test email content generation:**

```typescript
function generateTestAlertContent(
  user: User,
  alertType: string
): { html: string; text: string } {
  // Create mock benefit/card data for testing
  const mockBenefit = {
    name: 'Travel Credit',
    value: '$300',
    expiresIn: '5 days'
  };

  const mockCard = {
    name: 'Chase Sapphire Preferred',
    renewsIn: '45 days'
  };

  // Generate template content
  if (alertType === 'BENEFIT_EXPIRATION') {
    return generateBenefitExpirationEmail(user, mockBenefit);
  } else if (alertType === 'CARD_RENEWAL') {
    return generateCardRenewalEmail(user, mockCard);
  } else if (alertType === 'ALL_ALERTS') {
    return generateDigestEmail(user, {
      expiringBenefits: [mockBenefit],
      renewingCards: [mockCard],
      optimizationOpportunities: []
    });
  }

  return { html: '', text: '' };
}
```

---

### Amendment #4B: Unsubscribe Token Security - Rate Limiting Details

**Unsubscribe Rate Limit Rules:**

1. Max 5 attempts per IP per 15 minutes
2. Max 3 attempts per user per hour
3. Log all attempts (even successful ones)
4. Alert if suspicious pattern detected

**Suspicious Patterns:**
- Same token used multiple times (already handled)
- Multiple different tokens used from same IP
- High number of failures from same IP (possible brute force)

---

### Updated Implementation Task List

**Phase 1 additions:**
- Task 1.5: Timezone handling for email scheduling (3-4 hours)
- Task 1.6: DST transition handling (4-5 hours)
- Task 1.7: Unsubscribe token generation + verification (3-4 hours)
- Task 1.8: CSRF-protected unsubscribe endpoint (2-3 hours)

**Phase 2 additions:**
- Task 2.4: Alert timezone recalculation (2-3 hours)
- Task 2.5: Rate limiting on unsubscribe (1-2 hours)

**Phase 3 additions:**
- Task 3.3: Email bounce handling (3-4 hours)
- Task 3.4: Delivery retry logic + exponential backoff (3-4 hours)

**Phase 4 additions:**
- Task 4.5: Test email capability (2-3 hours)
- Task 4.6: Timezone testing across DST boundaries (4-5 hours)
- Task 4.7: Bounce handling integration tests (3-4 hours)
- Task 4.8: Unsubscribe token security tests (3-4 hours)

---

## Implementation Phases

### Phase 1: Core Email System (Days 1-3)
**Objectives:** Build email sending and preference system
- Estimated Scope: Large (12-15 hours)
- Email template system
- Preference management UI and storage
- Alert type enum and database schema
- Server-side preference validation
- Acceptance: Email sends, preferences save

### Phase 2: Alert Generation (Days 4-5)
**Objectives:** Implement alert detection and scheduling
- Estimated Scope: Large (12-15 hours)
- Cron jobs for daily/weekly checks
- Benefit expiration detection
- Renewal date detection
- Alert deduplication logic
- Acceptance: Alerts generated and queued correctly

### Phase 3: Email Delivery & Logging (Days 6-7)
**Objectives:** Email delivery service and audit trail
- Estimated Scope: Large (12-15 hours)
- Email service integration
- Retry logic and error handling
- Delivery tracking
- Email logging and history
- Acceptance: Emails delivered reliably, logged correctly

### Phase 4: Testing & Optimization (Days 8-9)
**Objectives:** Comprehensive testing and performance
- Estimated Scope: Large (12-15 hours)
- Unit tests for preference logic
- Integration tests for alert detection
- E2E tests for alert workflow
- Load testing for email delivery
- Acceptance: 80%+ coverage, no performance issues

**Phase Dependencies:**
- Phase 1 → Phase 2 (requires preference system)
- Phase 2 → Phase 3 (requires alert generation)
- All phases → Phase 4 (test everything)

---

## Data Schema / State Management

### Database Tables

#### UserEmailPreference
```
UserEmailPreference {
  id: String @id @default(cuid())
  userId: String

  // Global preferences
  emailNotificationsEnabled: Boolean @default(true)
  emailFrequency: 'Immediate' | 'Daily' | 'Weekly' | 'Monthly' @default('Daily')
  timeZone: String @default('America/New_York')  // User's timezone
  preferredTime: String @default('09:00')        // HH:mm in user's timezone

  // Alert type toggles
  enableBenefitExpirationAlerts: Boolean @default(true)
  benefitExpirationDaysBefore: Int @default(7)     // Alert N days before expiry

  enableRenewalAlerts: Boolean @default(true)
  renewalAlertDaysBefore: Int @default(14)        // Alert N days before renewal

  enableAnnualFeeAlerts: Boolean @default(true)
  annualFeeAlertDaysBefore: Int @default(30)      // Alert N days before fee due

  enableOptimizationAlerts: Boolean @default(true)
  optimizationCheckFrequency: 'Weekly' | 'Monthly' | 'Never' @default('Weekly')

  enableDigestEmails: Boolean @default(false)
  digestFrequency: 'Weekly' | 'Monthly' @default('Weekly')

  // Unsubscribe tracking
  isUnsubscribed: Boolean @default(false)
  unsubscribedAt: DateTime?
  unsubscribeReason: String?

  // Metadata
  createdAt: DateTime @default(now())
  updatedAt: DateTime @updatedAt

  // Relationships
  user: User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId])
  @@index([userId])
  @@index([isUnsubscribed])
}
```

#### SentAlert
```
SentAlert {
  id: String @id @default(cuid())
  userId: String
  playerId: String

  alertType: 'BenefitExpiration' | 'CardRenewal' | 'AnnualFee' | 'Optimization' | 'Digest'
  alertScope: 'Benefit' | 'Card' | 'Player' | 'System'  // What triggered alert

  // Content references
  benefitIds: String[]?                  // If benefit-specific
  cardIds: String[]?                     // If card-specific
  alertData: String                      // JSON blob of alert details

  // Delivery tracking
  deliveryStatus: 'Pending' | 'Sent' | 'Bounced' | 'Failed' | 'Unsubscribed'
  sentAt: DateTime?
  bouncedAt: DateTime?
  failedAt: DateTime?
  failureReason: String?

  // Email tracking
  emailSubject: String
  emailTemplate: String                  // Template name used
  emailFrom: String                      // From address
  emailTo: String                        // Recipient email

  // Engagement tracking (optional)
  openedAt: DateTime?
  clickedAt: DateTime?
  lastStatusCheckAt: DateTime?

  // Metadata
  createdAt: DateTime @default(now())
  scheduledFor: DateTime?                // When alert will be sent
  retryCount: Int @default(0)
  maxRetries: Int @default(3)

  // Relationships
  user: User @relation(fields: [userId], references: [id], onDelete: Cascade)
  player: Player @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([playerId])
  @@index([alertType])
  @@index([deliveryStatus])
  @@index([scheduledFor])
  @@index([createdAt])
}
```

#### AlertQueue
```
AlertQueue {
  id: String @id @default(cuid())

  alertType: string                      // BenefitExpiration, CardRenewal, etc
  benefitId: String?                     // If benefit-specific
  cardId: String?                        // If card-specific
  playerId: String
  userId: String

  alertDetails: String                   // JSON with all alert data

  // Processing status
  status: 'Pending' | 'Processing' | 'Sent' | 'Failed' | 'Skipped'
  processedAt: DateTime?
  error: String?                         // Error message if failed

  // Metadata
  createdAt: DateTime @default(now())
  processAfter: DateTime @default(now()) // When to process this alert

  // Relationships
  user: User @relation(fields: [userId], references: [id], onDelete: Cascade)
  player: Player @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@index([status])
  @@index([processAfter])
  @@index([createdAt])
  @@index([userId])
}
```

### In-Memory State (For Email Rendering)

```
AlertContext {
  // User info
  userId: string
  userEmail: string
  userName: string
  timeZone: string

  // Alert-specific data
  alertType: 'BenefitExpiration' | 'CardRenewal' | 'AnnualFee' | 'Optimization' | 'Digest'

  // For benefit alerts
  expiringBenefits?: {
    id: string
    name: string
    stickerValue: number
    userDeclaredValue: number | null
    effectiveValue: number
    expirationDate: Date
    daysUntilExpiration: number
    isUsed: boolean
    card: {
      id: string
      name: string
      customName: string | null
      issuer: string
    }
  }[]

  // For renewal alerts
  renewingCards?: {
    id: string
    name: string
    customName: string | null
    issuer: string
    annualFee: number
    renewalDate: Date
    daysUntilRenewal: number
  }[]

  // For optimization alerts
  opportunities?: {
    type: 'UnusedBenefit' | 'LowROICard' | 'ExpiringUnclaimed'
    severity: 'Info' | 'Warning' | 'Critical'
    description: string
    recommendation: string
  }[]

  // For digest
  digest?: {
    expiringCount: number
    renewingCount: number
    unusedBenefitsCount: number
    totalWalletROI: number
    month: string
  }
}
```

---

## User Flows & Workflows

### User Receives Benefit Expiration Alert

```
1. System daily job runs at 9 AM UTC
   ├─ Queries: UserBenefit WHERE expirationDate < now() + 7 days
   ├─ Filters: isUsed = false (unclaimed benefits)
   ├─ Checks user preferences: benefitExpirationAlerts enabled, daysBefore = 7
   ├─ Checks: No alert sent for this benefit yet

2. Generates alert
   ├─ Creates AlertQueue entry
   ├─ Status: Pending
   ├─ ProcessAfter: Today at user's preferred time

3. Later at 9 AM user's timezone
   ├─ AlertQueue job picks up pending alerts
   ├─ Renders email template with:
   │  ├─ Benefits expiring this week
   │  ├─ Which card each belongs to
   │  ├─ Current value and claimed status
   │  └─ Quick link to claim benefit
   ├─ Sends email to user

4. Email delivery
   ├─ Email service sends message
   ├─ Tracking: delivery status recorded
   ├─ Creates SentAlert record
   ├─ Status: Sent (if successful)

5. User receives email
   ├─ Subject: "3 benefits expiring this week - Take action!"
   ├─ Body: Summary of expiring benefits
   ├─ CTA: "Claim Now" button
   ├─ Footer: Preferences link, Unsubscribe link

6. User can click through
   ├─ "Claim Now" → Dashboard, benefit highlighted
   ├─ "Preferences" → Settings page
   ├─ "Unsubscribe" → One-click opt-out with confirmation
```

### Manage Email Preferences

```
1. User clicks account/settings icon
   ├─ Goes to Settings → Notifications

2. Notification preferences page loads
   ├─ Shows UserEmailPreference form
   ├─ Toggles for each alert type
   ├─ Day-before configurable (dropdown)
   ├─ Email frequency (Immediate, Daily, Weekly, Monthly)
   ├─ Timezone selector
   ├─ Preferred time picker

3. Current settings:
   ├─ Benefit expiration: ON, 7 days before
   ├─ Card renewal: ON, 14 days before
   ├─ Annual fee: ON, 30 days before
   ├─ Optimization: OFF
   ├─ Digest: OFF
   ├─ Email frequency: Daily
   ├─ Timezone: America/New_York
   ├─ Preferred time: 09:00

4. User changes:
   ├─ Turns off Optimization alerts
   ├─ Changes benefit expiration to 3 days before
   ├─ Turns on Digest emails (Weekly)

5. User clicks "Save"
   ├─ Updates UserEmailPreference
   ├─ Toast: "Preferences updated"
   ├─ No page reload

6. Future alerts respect new settings
   ├─ Only benefit expiration, renewal, fee, digest sent
   ├─ Benefit alert 3 days before instead of 7
   ├─ Digest sent weekly instead of daily
```

### Unsubscribe from Emails

```
1. User receives email
   ├─ Reads email about expiring benefits

2. User clicks "Unsubscribe" link in footer
   ├─ Link includes signed token (prevents spoofing)
   ├─ Example: /unsubscribe?token=xyz&userId=abc

3. Unsubscribe confirmation page loads
   ├─ Shows: "Are you sure you want to unsubscribe?"
   ├─ Explains: "You'll no longer receive email alerts"
   ├─ Button: "Yes, unsubscribe"
   ├─ Link: "I changed my mind"

4. User confirms unsubscribe
   ├─ Sets UserEmailPreference.isUnsubscribed = true
   ├─ Records unsubscribeReason (optional)
   ├─ Toast: "You've been unsubscribed"
   ├─ Shows: "Resubscribe anytime in Settings"

5. No more emails sent
   ├─ Alert generation skips unsubscribed users
   ├─ Existing SentAlerts.deliveryStatus = Unsubscribed

6. User can re-subscribe
   ├─ Go to Settings
   ├─ "You're currently unsubscribed"
   ├─ Button: "Resubscribe to email alerts"
   ├─ Sets isUnsubscribed = false
   ├─ Resumes normal email flow
```

### Smart Alert Batching

```
Morning check at 9 AM:
  Benefits expiring this week:
  - Travel Credit (Chase Sapphire) expires March 31 (in 5 days)
  - Dining Credit (Amex Gold) expires April 1 (in 6 days)
  - Uber Cash (Chase Freedom) expires April 5 (in 10 days)

Instead of sending 3 emails:
┌─────────────────────────────────────────┐
│ Email 1: "3 Benefits Expiring This Week"│
│                                          │
│ Travel Credit (Chase Sapphire)          │
│  - Expires: March 31, 2024              │
│  - Value: $100 (unused)                 │
│  [Claim Now Button]                     │
│                                          │
│ Dining Credit (Amex Gold)               │
│  - Expires: April 1, 2024               │
│  - Value: $50 (unused)                  │
│  [Claim Now Button]                     │
│                                          │
│ Uber Cash (Chase Freedom)               │
│  - Expires: April 5, 2024               │
│  - Value: $15 (unused)                  │
│  [Claim Now Button]                     │
│                                          │
│ Total value at risk: $165               │
└─────────────────────────────────────────┘

Benefits:
- Single email instead of 3 (avoid fatigue)
- Context: See all benefits at once
- Urgency: Total value summary motivates action
```

### Digest Email (Weekly)

```
Monday morning email summarizes:

┌────────────────────────────────────┐
│ Weekly Wallet Summary              │
│ Week of March 25 - March 31        │
│                                     │
│ UPCOMING ACTIONS                   │
│ ├─ 2 benefits expiring this week   │
│ │  └─ Total value: $150 (unclaimed)│
│ ├─ 1 card renewing this month      │
│ │  └─ Annual fee: $550              │
│ └─ Rewards estimate this week      │
│    └─ $45 earned so far            │
│                                     │
│ WALLET STATUS                      │
│ ├─ Total cards: 8 (all active)     │
│ ├─ Total benefits: 52              │
│ ├─ Active ROI: 42.5%               │
│ ├─ Annual value: $8,200            │
│ └─ Comparison: ↑ 2.3% from last wk │
│                                     │
│ OPPORTUNITIES                      │
│ ├─ 1 benefit unused for 60+ days   │
│ │  └─ American Express Dining      │
│ └─ Recommendation:                 │
│    └─ Cancel if you won't use it   │
│                                     │
│ [View Full Dashboard]              │
└────────────────────────────────────┘
```

---

## Email Templates

### Template 1: Benefit Expiration Alert

```html
Subject: [X] Benefits Expiring This Week - Take Action!

Body:

Dear [User Name],

[X] benefits are expiring within the next [N] days. Don't let
rewards go to waste!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXPIRING BENEFITS

┌─────────────────────────────────────────────────┐
│ Travel Credit                                    │
│ Chase Sapphire Reserve                          │
│ Value: $300 (your value)                        │
│ Expires: March 31, 2024 (5 days from now)       │
│ Status: Unused                                  │
│                                                  │
│ [CLAIM NOW] [View Card]                         │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Dining Credit                                    │
│ American Express Gold                           │
│ Value: $50 (your value)                         │
│ Expires: April 1, 2024 (7 days from now)        │
│ Status: Unused                                  │
│                                                  │
│ [CLAIM NOW] [View Card]                         │
└─────────────────────────────────────────────────┘

Total value at risk: $350

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Manage Preferences] [View Dashboard]

Questions? Reply to this email.

---
Copyright © 2024 Card Benefits Tracker
[Unsubscribe] [Preferences] [Contact Us]
```

### Template 2: Card Renewal Alert

```html
Subject: Card Renewal Coming - [Card Name] Renews [Date]

Body:

Dear [User Name],

Your [Card Name] card renews on [Renewal Date]. Here's what
you need to know.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RENEWAL DETAILS

Card:               Chase Sapphire Reserve
Renewal Date:       April 15, 2024 (14 days from now)
Annual Fee:         $550

BENEFITS RESETTING
├─ Travel Credit: Resets to $300
├─ Dining Credit: Resets to $100
├─ Uber Cash: Resets to $50
└─ 4 more benefits will reset

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YEARLY METRICS FOR THIS CARD
├─ Annual ROI: 45%
├─ Benefit Value: $4,500
├─ Annual Fee: -$550
└─ Net Value: +$3,950

Renewing this card is worth it!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[View Card Details] [Manage Preferences]

---
Copyright © 2024 Card Benefits Tracker
[Unsubscribe] [Preferences] [Contact Us]
```

### Template 3: Digest Email

```html
Subject: Weekly Wallet Summary - [Week Date Range]

[See digest example in User Flows above]
```

---

## API Routes & Contracts

### Preference Management Endpoints

#### 1. Get Email Preferences
```
GET /api/user/email-preferences

Response Success (200):
  {
    success: true
    preferences: {
      emailNotificationsEnabled: boolean
      emailFrequency: 'Immediate' | 'Daily' | 'Weekly' | 'Monthly'
      timeZone: string
      preferredTime: string

      enableBenefitExpirationAlerts: boolean
      benefitExpirationDaysBefore: number

      enableRenewalAlerts: boolean
      renewalAlertDaysBefore: number

      enableAnnualFeeAlerts: boolean
      annualFeeAlertDaysBefore: number

      enableOptimizationAlerts: boolean
      optimizationCheckFrequency: string

      enableDigestEmails: boolean
      digestFrequency: string

      isUnsubscribed: boolean
    }
  }
```

#### 2. Update Email Preferences
```
PUT /api/user/email-preferences

Request:
  {
    emailNotificationsEnabled?: boolean
    emailFrequency?: 'Immediate' | 'Daily' | 'Weekly' | 'Monthly'
    timeZone?: string
    preferredTime?: string
    enableBenefitExpirationAlerts?: boolean
    benefitExpirationDaysBefore?: number
    ... (other fields)
  }

Response Success (200):
  {
    success: true
    preferences: { ... updated preferences ... }
  }

Response Error (400):
  {
    success: false
    error: 'VALIDATION_FIELD'
    message: 'benefitExpirationDaysBefore must be between 1 and 30'
  }
```

#### 3. Unsubscribe from Emails
```
POST /api/user/unsubscribe

Request:
  {
    token?: string  // Optional signed token from email link
  }

Response Success (200):
  {
    success: true
    message: 'You have been unsubscribed'
  }
```

#### 4. Resubscribe to Emails
```
POST /api/user/resubscribe

Request:
  {}

Response Success (200):
  {
    success: true
    message: 'You have been resubscribed'
    preferences: { ... }
  }
```

### Alert Management Endpoints (Internal/Admin)

#### 5. Get Alert History
```
GET /api/alerts/history
Query:
  type?: string (filter by alert type)
  status?: string (Sent, Bounced, Failed)
  limit?: number (default 20)
  offset?: number (default 0)

Response Success (200):
  {
    success: true
    alerts: SentAlert[]
    total: number
  }
```

#### 6. Resend Alert
```
POST /api/alerts/{alertId}/resend

Response Success (200):
  {
    success: true
    alert: SentAlert
  }
```

### Cron Endpoints (Secured)

#### 7. Trigger Daily Alert Check
```
POST /api/cron/check-alerts

Headers:
  X-CRON-SECRET: [secret key]

Response Success (200):
  {
    success: true
    alertsGenerated: number
    alertsQueued: number
  }

Response Error (403):
  {
    success: false
    error: 'UNAUTHORIZED'
  }
```

---

## Component Architecture

### Email System Architecture

```
Daily Cron Job (9 AM UTC)
    ↓
AlertDetector (finds triggering events)
├─ BenefitExpirationDetector
├─ CardRenewalDetector
├─ AnnualFeeDetector
├─ OptimizationDetector
└─ DigestGenerator
    ↓
AlertQueue (queued for processing)
    ├─ Create AlertQueue entries
    ├─ Schedule for user's preferred time
    └─ Batch related alerts
    ↓
AlertProcessingJob (at user's preferred time)
├─ Fetch pending AlertQueue entries
├─ Check UserEmailPreference (still enabled?)
├─ Render email template
└─ Queue for sending
    ↓
EmailService (sends actual emails)
├─ SMTP or email API
├─ Track delivery status
└─ Log SentAlert record
    ↓
SentAlert (audit trail)
├─ Recipient and content
├─ Delivery status
├─ Open/click tracking (optional)
└─ Retry logic
```

### UI Components

#### 1. EmailPreferencesForm
```
EmailPreferencesForm
├─ Header: "Notification Settings"
├─ Master toggle: "Email Notifications On/Off"
├─ Global frequency selector
├─ Timezone picker
├─ Preferred time picker
├─
├─ Alert Type Sections:
│  ├─ Benefit Expiration
│  │  ├─ Toggle
│  │  ├─ Days before dropdown (1-30)
│  │  └─ Note: "Unclaimed benefits only"
│  │
│  ├─ Card Renewal
│  │  ├─ Toggle
│  │  ├─ Days before dropdown
│  │  └─ Note: "Benefits will reset"
│  │
│  ├─ Annual Fee
│  │  ├─ Toggle
│  │  ├─ Days before dropdown
│  │  └─ Note: "Renewal fee due date"
│  │
│  ├─ Optimization Alerts
│  │  ├─ Toggle
│  │  ├─ Frequency: Weekly/Monthly/Never
│  │  └─ Note: "Unused benefits, low ROI"
│  │
│  └─ Weekly Digest
│     ├─ Toggle
│     ├─ Frequency: Weekly/Monthly
│     └─ Shows: "Summary of all alerts"
│
├─ Action Buttons
│  ├─ "Save Changes"
│  ├─ "Test Email" (sends test alert)
│  └─ "Unsubscribe from all"
│
└─ Status Messages
   ├─ Success: "Preferences updated"
   ├─ Error: "Failed to save..."
   └─ Info: "Changes effective immediately"
```

#### 2. AlertHistory Component
```
AlertHistory
├─ Header: "Alert History"
├─ Filters
│  ├─ Type dropdown (all types)
│  ├─ Status dropdown (Sent, Bounced, Failed)
│  └─ Date range picker
├─
├─ Alert List
│  ├─ Columns: Date, Type, Status, Subject, Action
│  │
│  └─ Rows:
│     ├─ [Date] [Type] [Status ✓] [Subject] [View] [Resend]
│     ├─ [Date] [Type] [Status ✗] [Subject] [View] [Resend]
│     └─ ...
│
└─ Pagination
   ├─ Previous/Next buttons
   └─ "Showing 1-20 of 143"
```

#### 3. UnsubscribeConfirmation Component
```
UnsubscribeConfirmation
├─ Heading: "Unsubscribe from Email Alerts"
├─
├─ Message:
│  "Are you sure you want to unsubscribe?
│   You'll no longer receive any email notifications."
│
├─ What you'll miss:
│  ├─ ❌ Benefit expiration reminders
│  ├─ ❌ Card renewal alerts
│  ├─ ❌ Annual fee notifications
│  ├─ ❌ Optimization tips
│  └─ ❌ Weekly wallet summary
│
├─ Re-subscribe:
│  "You can resubscribe anytime in Settings"
│
├─ Buttons:
│  ├─ [Yes, Unsubscribe]
│  └─ [I Changed My Mind]
│
└─ Footer:
   "We respect your preferences. No judgment!"
```

---

## Edge Cases & Error Handling

### 1. User Unsubscribed, But Preferred Action Needed
**Scenario:** User unsubscribed from all emails. Card renewal due in 3 days and annual fee is $550.
**Handling:**
- Do not send email (respect unsubscribe)
- Show in-app notification (if enabled)
- User can check dashboard manually
- Suggest in settings: "We're not notifying you, but your card renews soon"
- Test: Unsubscribed status prevents all emails

### 2. User's Email Bounces (Hard Bounce)
**Scenario:** Email service reports permanent bounce (invalid address)
**Handling:**
- Update SentAlert.deliveryStatus = Bounced
- Flag user account for email review
- Do not retry (hard bounce)
- Show in Settings: "Email delivery failed. Update your email address."
- Prevent silent email blackhole
- Test: Hard bounce handling

### 3. Soft Bounce, Retry Later
**Scenario:** Temporary bounce (mailbox full, server down). Retry later.
**Handling:**
- Update SentAlert.deliveryStatus = Pending
- Retry with exponential backoff (1 hour, 4 hours, 24 hours)
- Max retries: 3
- After 3 failed retries: mark as failed, notify user
- Test: Retry logic and exponential backoff

### 4. Duplicate Alerts Sent
**Scenario:** Cron job runs twice (or slow completion). Both send alerts.
**Handling:**
- Implement idempotency: check if alert already sent
- Use unique constraint: (userId, benefitId, alertType, date)
- If duplicate detected: skip
- Deduplication at AlertQueue level before processing
- Test: Idempotent alert generation

### 5. User Changed Preferences Mid-Alert
**Scenario:** User receives alert notification. Minutes later turns off that alert type.
**Handling:**
- Email already in queue, will be sent
- User receives one more email
- Future alerts respect new preference
- Not a problem (expected behavior)
- Test: Preference changes don't affect queued alerts

### 6. Timezone Calculation Wrong (DST)
**Scenario:** User in EST (UTC-5). Clock changes to EDT (UTC-4). Scheduled email time wrong.
**Handling:**
- Use timezone-aware calculations (moment-tz or similar)
- Recalculate scheduled times on DST transition
- Account for user's actual timezone changes
- Email sent at 9 AM user's local time (always)
- Test: DST transitions, timezone changes

### 7. Very Large Batch Alert (1000+ Benefits)
**Scenario:** User with massive wallet. Expiring 100+ benefits.
**Handling:**
- Batch into multiple sections
- Summarize: "100 benefits expiring" instead of listing all
- Link to dashboard for full list
- Show top 10 by value, then summary
- Email size reasonable (< 25MB)
- Test: Large batch alert handling

### 8. User Has No Email Address
**Scenario:** User account created, email field not set
**Handling:**
- Skip email sending for users without email
- Show in-app notification instead (if available)
- Prompt user: "Set your email address to receive alerts"
- Do not create SentAlert record (can't send)
- Test: Null email handling

### 9. Email Service Outage
**Scenario:** SMTP server or email API down for 2 hours
**Handling:**
- Alerts queued but not sent
- Automatic retry with backoff
- Admin notified of service issue
- Manual resend option once service restored
- No data loss (AlertQueue persists)
- Test: Service outage resilience

### 10. Custom Timezone Not Recognized
**Scenario:** User's timezone changed to "Invalid/Zone"
**Handling:**
- Default to UTC or user's browser timezone
- Show warning: "Could not recognize timezone"
- Allow user to pick from dropdown
- Validate timezone on save
- Test: Invalid timezone handling

### 11. Alert with Expired Benefit
**Scenario:** Alert generated for benefit. By time email sends, benefit already expired.
**Handling:**
- Check expiration date again before sending
- If expired: skip or modify subject line
- Subject: "Benefit just expired" instead of "expiring"
- Still send (user may not realize they missed it)
- Test: Stale benefit data

### 12. Benefit Deleted While Alert Processing
**Scenario:** Alert references benefit. Benefit deleted (soft or hard).
**Handling:**
- Check if benefit still exists before sending
- If deleted: change alert to "Benefit no longer available"
- Or skip alert if hard deleted
- Handle gracefully (no exceptions)
- Test: Deleted resource handling

### 13. User's Card No Longer Exists
**Scenario:** Alert for card renewal. Card deleted.
**Handling:**
- Check if card still exists
- If deleted/archived: skip alert
- Or modify alert: "This card is no longer active"
- Graceful degradation
- Test: Deleted card handling

### 14. Frequency Preferences Conflict
**Scenario:** User has conflicting preferences (immediate + weekly digest)
**Handling:**
- Immediate alerts sent right away
- Digest batched with next digest cycle
- No duplicates (same alert in digest and immediate)
- Clear preference UX (prevent conflicts)
- Test: Preference conflict resolution

### 15. Test Email Feature
**Scenario:** User clicks "Send Test Email"
**Handling:**
- Send sample alert with dummy data
- Subject: "[TEST] Sample Benefit Expiration Alert"
- Real email, real delivery tracking
- Shows: "Test email sent to [email]"
- Helps verify email delivery
- Test: Test email functionality

---

## Implementation Tasks

### Phase 1: Core Email System (Days 1-3)

**Task 1.1:** Email preference schema and UI
- Complexity: Medium (5-6 hours)
- Add UserEmailPreference table to schema
- Create EmailPreferencesForm component
- Implement save/load preferences
- Test form validation
- Acceptance criteria:
  - Preferences persist in database
  - UI updates on changes
  - All fields save correctly
  - Validation working

**Task 1.2:** Email template system
- Complexity: Medium (5-6 hours)
- Create email template engine (mjml or handlebars)
- Design 3+ templates (benefit, renewal, digest)
- Make templates responsive
- Test rendering
- Acceptance criteria:
  - Templates render correctly
  - Mobile responsive
  - All data fields populated
  - HTML valid

**Task 1.3:** Unsubscribe functionality
- Complexity: Medium (4-5 hours)
- Implement unsubscribe logic
- Create unsubscribe confirmation page
- Add secure token generation
- Test one-click unsubscribe
- Acceptance criteria:
  - Unsubscribe works via link
  - Confirmation required
  - No emails sent after unsubscribe
  - Resubscribe functionality works

### Phase 2: Alert Generation (Days 4-5)

**Task 2.1:** Benefit expiration alert detection
- Complexity: Medium (5-6 hours)
- Create BenefitExpirationDetector
- Query benefits expiring in N days
- Check user preferences
- Prevent duplicate alerts
- Create AlertQueue entries
- Acceptance criteria:
  - Detects expiring benefits correctly
  - Respects user preferences
  - No duplicates
  - AlertQueue entries created

**Task 2.2:** Card renewal and fee alert detection
- Complexity: Medium (5-6 hours)
- Create CardRenewalDetector
- Create AnnualFeeDetector
- Query cards renewing in N days
- Combine related alerts
- Create AlertQueue entries
- Acceptance criteria:
  - Detects renewals correctly
  - Detects fees correctly
  - Combines when needed
  - AlertQueue entries created

**Task 2.3:** Cron job scheduling
- Complexity: Medium (4-5 hours)
- Set up daily cron (9 AM UTC)
- Implement alert detection job
- Secure endpoint (prevent timing attacks)
- Add logging and monitoring
- Acceptance criteria:
  - Cron runs at scheduled time
  - Detects all alerts
  - Endpoint secured with token
  - Logs all activity

### Phase 3: Email Delivery & Logging (Days 6-7)

**Task 3.1:** Email service integration
- Complexity: Medium (5-6 hours)
- Choose email service (SendGrid, AWS SES, etc)
- Implement email sending
- Handle delivery response
- Implement retry logic
- Acceptance criteria:
  - Emails send successfully
  - Delivery tracked
  - Retry logic works
  - Service integrated

**Task 3.2:** Alert delivery job and batching
- Complexity: Medium (5-6 hours)
- Create AlertProcessingJob
- Batch related alerts
- Render email templates with data
- Handle user timezone
- Send at preferred time
- Acceptance criteria:
  - Alerts sent on schedule
  - Batching works
  - Timezone respected
  - Delivery logged

**Task 3.3:** Email logging and audit trail
- Complexity: Medium (4-5 hours)
- Create SentAlert table
- Log all sent emails
- Track delivery status
- Implement resend functionality
- Create AlertHistory UI
- Acceptance criteria:
  - All emails logged
  - Delivery status tracked
  - Resend works
  - History UI functional

### Phase 4: Testing & Optimization (Days 8-9)

**Task 4.1:** Unit tests for preferences and detection
- Complexity: Large (8-10 hours)
- Test preference validation (15+ tests)
- Test alert detection logic (25+ tests)
- Test deduplication (10+ tests)
- Test batching logic (10+ tests)
- Acceptance criteria:
  - Coverage 85%+
  - All paths tested
  - Edge cases covered

**Task 4.2:** Integration tests for alert workflow
- Complexity: Large (8-10 hours)
- Test end-to-end alert creation (8+ tests)
- Test email delivery (8+ tests)
- Test preference changes (8+ tests)
- Test unsubscribe workflow (6+ tests)
- Acceptance criteria:
  - Coverage 80%+
  - All workflows tested
  - Integration points verified

**Task 4.3:** E2E tests for user workflows
- Complexity: Large (8-10 hours)
- Playwright test for preference updates
- Playwright test for alert receipt
- Playwright test for unsubscribe
- Playwright test for resubscribe
- Acceptance criteria:
  - 6-8 E2E tests
  - Critical paths covered
  - Real email sending tested

**Task 4.4:** Load testing and reliability
- Complexity: Large (8-10 hours)
- Test with 1000+ pending alerts
- Test email delivery performance
- Test cron job performance
- Test database query optimization
- Acceptance criteria:
  - Handles 10K+ alerts without slowdown
  - Email delivery < 500ms
  - Cron completes in < 5 minutes
  - No memory leaks

---

## Security & Compliance Considerations

### Email Compliance
- **CAN-SPAM:** Include physical address and unsubscribe option
- **GDPR:** Respect user's email preferences and right to erasure
- **Double opt-in:** Optional confirmation for email subscription (security best practice)

### Data Security
- Secure unsubscribe tokens (HMAC signed, time-limited)
- Hash emails in logs if not needed plaintext
- Encrypt email content at rest (if in database)
- TLS for email transmission

### Privacy
- No tracking pixels or read receipts (privacy-respecting)
- Optional: Disable open/click tracking
- Minimal PII in logs
- Data retention policy (delete logs after 90 days)

### Authorization
- Only send alerts to user's own email
- Verify user owns the email before sending
- Respect unsubscribe status

---

## Performance & Scalability Considerations

### Performance Targets

| Operation | Data Size | Target Time |
|-----------|-----------|------------|
| Generate alerts | 1000 users | < 5 minutes |
| Send email batch | 100 emails | < 30 seconds |
| Save preference | - | < 200ms |
| Render template | - | < 100ms |

### Database Optimization

**Indexes:**
- UserEmailPreference(userId) - PK
- SentAlert(userId, createdAt)
- SentAlert(deliveryStatus, scheduledFor)
- AlertQueue(status, processAfter)

**Query optimization:**
- Batch queries for alert detection
- Use LIMIT/OFFSET for pagination
- Archive old SentAlerts (90+ days)

### Email Service Optimization
- Use service's batch sending API
- Implement connection pooling
- Retry failed sends with backoff
- Monitor delivery metrics

### Scalability for Growth
- Current design supports 100K+ users
- Estimated 2-5 alerts per user per month
- Database retention: SentAlerts for 90 days
- Archive or purge older data
- Consider: Kafka for alert queuing (if 1M+ users)

---

## Quality Control Checklist

- [x] All functional requirements addressed
- [x] Data schema supports alert system
- [x] API design RESTful and consistent
- [x] All user flows documented with error paths
- [x] 15 edge cases documented with handling
- [x] Components modular and independently testable
- [x] Implementation tasks specific with criteria
- [x] Security and compliance verified
- [x] Performance targets defined
- [x] Scalability considered
- [x] Email templates professional and tested
- [x] Cron security (timing attack prevention)

---

## References & Examples

### Sample Alert Data Structure

```json
{
  "alertType": "BenefitExpiration",
  "userId": "user_123",
  "playerId": "player_456",
  "benefits": [
    {
      "id": "ben_789",
      "name": "Travel Credit",
      "card": {
        "id": "card_111",
        "name": "Chase Sapphire Reserve",
        "customName": "My Primary Card"
      },
      "stickerValue": 30000,
      "userDeclaredValue": 30000,
      "expirationDate": "2024-03-31T23:59:59Z",
      "daysUntilExpiration": 5,
      "isUsed": false
    }
  ],
  "scheduledFor": "2024-03-27T09:00:00-04:00",
  "userTimeZone": "America/New_York"
}
```

### Sample Email (Text Version)

```
SUBJECT: 2 Benefits Expiring This Week - Take Action!

Dear John,

You have 2 benefits expiring within the next 7 days.
Don't let rewards go to waste!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXPIRING BENEFITS

Travel Credit - Chase Sapphire Reserve
├─ Value: $300 (your value)
├─ Expires: March 31, 2024 (5 days from now)
├─ Status: Unused
└─ Action: https://cardbenefits.example.com/benefits/ben_789/claim

Dining Credit - American Express Gold
├─ Value: $50 (your value)
├─ Expires: April 1, 2024 (6 days from now)
├─ Status: Unused
└─ Action: https://cardbenefits.example.com/benefits/ben_790/claim

Total value at risk: $350

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Questions? Reply to this email or visit:
https://cardbenefits.example.com/support

---
Manage Preferences: https://cardbenefits.example.com/settings/emails
Unsubscribe: https://cardbenefits.example.com/unsubscribe?token=xyz

Card Benefits Tracker
© 2024 All rights reserved.
```

---

**Document Version:** 1.0
**Last Updated:** April 2, 2026
**Status:** Ready for Implementation
**Next Phase:** Task 1.1 - Email preference schema and UI
