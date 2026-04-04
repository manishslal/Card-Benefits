# Card Benefits Tracker

Track credit card rewards, benefits, and ROI all in one place.

**Card Benefits Tracker** is a modern web application that helps you maximize the value of your credit cards. Easily manage multiple cards, track annual fees and benefits, calculate return on investment, and never miss a benefit again.

## ✨ Key Features

- **Card Management** — Add cards manually or import via CSV. Organize, edit, and archive cards effortlessly.
- **Benefit Tracking** — Track unlimited benefits per card. Categorize by type (cashback, points, miles, perks) and monitor usage.
- **ROI Calculation** — Automatically calculates return on investment. Know exactly which cards are worth keeping.

## 🚀 Quick Start

Get up and running in 5 minutes:

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/card-benefits-tracker.git
cd card-benefits-tracker

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your database URL and other settings

# 4. Start the development server
npm run dev

# Open http://localhost:3000 in your browser
```

**New to the app?** Check out [QUICK_START.md](./QUICK_START.md) for a complete walkthrough.

## 📚 Documentation

- **[Quick Start Guide](./QUICK_START.md)** — 5-minute setup walkthrough
- **[User Guides](./docs/USER_GUIDES/)** — Feature-specific instructions
  - [Import Cards from CSV](./docs/USER_GUIDES/IMPORT_CSV.md)
  - [Add Cards Manually](./docs/USER_GUIDES/ADD_CARD.md)
  - [Custom Benefit Values](./docs/USER_GUIDES/CUSTOM_VALUES.md)
  - [FAQ](./docs/USER_GUIDES/FAQ.md)
  - [Troubleshooting](./docs/USER_GUIDES/TROUBLESHOOTING.md)
- **[Developer Guides](./docs/DEVELOPER_GUIDES/)** — For contributors
- **[Legal Documents](./docs/LEGAL/)**
  - [Privacy Policy](./PRIVACY_POLICY.md)
  - [Terms of Service](./TERMS_OF_SERVICE.md)

## 🛠 Tech Stack

- **Frontend:** [Next.js 15](https://nextjs.org/) with React 19
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL with [Prisma ORM](https://www.prisma.io/)
- **Styling:** Tailwind CSS
- **UI Components:** Radix UI, shadcn/ui, Lucide icons
- **Authentication:** JWT with password hashing (Argon2)
- **Testing:** Vitest (unit), Playwright (E2E)
- **Import/Export:** CSV and XLSX support
- **Rate Limiting:** In-memory (single instance) / Redis-backed (multi-instance)

## 🚀 Scaling to Multiple Instances

The application is currently optimized for single-instance deployment. When scaling to multiple server instances, distributed rate limiting is required to prevent users from bypassing rate limits by hitting different instances.

### Current State (Single Instance)
- ✅ In-memory rate limiting (no additional infrastructure)
- ✅ Works perfectly for single server
- ✅ Zero additional cost

### Future State (Multi-Instance)
To scale to multiple instances with shared rate limits:

#### 1. Add Redis Service
```bash
# On Railway:
# Dashboard → Create → Service → Marketplace → Redis (Managed)
# Railway will automatically set REDIS_URL environment variable
```

#### 2. Install Dependencies
```bash
npm install ioredis
```

#### 3. Enable Distributed Rate Limiting
Set environment variables:
```
REDIS_URL=redis://[auto-set by Railway]
ENABLE_REDIS_RATE_LIMITING=true
```

#### 4. Update Application
The distributed rate limiter implementation is ready to use:
- See [`.github/specs/REDIS-RATE-LIMITING-SPEC.md`](./.github/specs/REDIS-RATE-LIMITING-SPEC.md) for full specification
- Template implementation: [`src/lib/redis-rate-limiter.ts`](./src/lib/redis-rate-limiter.ts)
- Integration example: [`src/middleware-redis-example.ts`](./src/middleware-redis-example.ts)

#### 5. Deploy Multi-Instance Setup
```bash
# Increase instance count in Railway
# Monitor that rate limits are now shared across instances
```

### Cost Impact
- **Managed Redis (256MB plan):** ~$5/month on Railway
- **Additional server instance:** ~$5/month per instance
- **Total increase for 2-instance deployment:** ~$10/month

### When to Implement
- **Trigger:** When planning to deploy 2+ server instances
- **Timeline:** 2-3 weeks of preparation + testing
- **Complexity:** Low (template and tests already provided)

### Key Features of Distributed Rate Limiting
- ✅ Shared rate limit state across all instances
- ✅ Automatic Redis fallback (allows requests if Redis unavailable)
- ✅ Atomic operations using Lua scripts
- ✅ Automatic key expiration (no manual cleanup)
- ✅ Per-endpoint configuration (login, cron, API)

### Learn More
- [Redis Rate Limiting Specification](./.github/specs/REDIS-RATE-LIMITING-SPEC.md) — Complete technical design
- [Template Implementation](./src/lib/redis-rate-limiter.ts) — Production-ready code with full comments
- [Middleware Integration Example](./src/middleware-redis-example.ts) — How to integrate into routes/middleware

## 📋 Requirements

- **Node.js** 18 or higher
- **npm** 9 or higher (or yarn/pnpm)
- **PostgreSQL** 13 or higher
- Modern web browser (Chrome, Firefox, Safari, Edge)

## 🤝 Contributing

We welcome contributions! Please see our [contribution guidelines](./docs/CONTRIBUTING.md) for details.

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## ❓ Need Help?

- Check the [FAQ](./docs/USER_GUIDES/FAQ.md) for common questions
- Visit [Troubleshooting](./docs/USER_GUIDES/TROUBLESHOOTING.md) for common issues
- Email support: support@cardbenefitstacker.com
- Open an [issue on GitHub](https://github.com/yourusername/card-benefits-tracker/issues)

## 🙏 Acknowledgments

Built with ❤️ for credit card enthusiasts and travelers.

---

**Made with Next.js • PostgreSQL • Prisma**