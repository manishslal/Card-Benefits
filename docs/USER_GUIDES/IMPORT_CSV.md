# Import Cards from CSV

Quickly add multiple credit cards to your portfolio using a CSV file.

## 📖 What is CSV Import?

CSV (Comma-Separated Values) import lets you add up to 10,000 cards at once. Perfect for:
- **Migrating from another app** — Import your existing card data
- **Bulk setup** — Add all family members' cards quickly
- **Data backup/restore** — Re-import previously exported data

## 📋 CSV File Requirements

### Columns Required

Your CSV file must have these **exact column names** (case-sensitive):

| Column Name | Required? | Description | Example |
|-------------|-----------|-------------|---------|
| `Card Issuer` | ✅ Yes | Bank/company that issued card | Chase, Amex, Capital One, Discover |
| `Card Name` | ✅ Yes | Card product name | Sapphire Preferred, Gold Card, Unlimited |
| `Annual Fee` | ✅ Yes | Annual fee in USD (number only) | 0, 95, 150, 250 |

### Format Examples

**Correct CSV:**
```csv
Card Issuer,Card Name,Annual Fee
Chase,Sapphire Preferred,95
American Express,Gold Card,250
Capital One,Quicksilver,0
Discover,It,0