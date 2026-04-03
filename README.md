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