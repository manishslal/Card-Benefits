# Verified Credit Card Benefit Cadences — Research Report

> **Research Date:** July 2025
> **Methodology:** Cross-referenced NerdWallet, UpgradedPoints, CreditCards.com, issuer websites (americanexpress.com, chase.com, usbank.com), and other reputable sources.
> **Important:** Card benefits change frequently. Always verify against the issuer's current terms before making database updates.

---

## 1. American Express Platinum Card — $695 annual fee

| # | Benefit Name (in our DB) | Verified Cadence | Per-Period Amount | Annual Total | Special Rules | Source |
|---|---|---|---|---|---|---|
| 1 | $600 Annual Hotel Credit | SEMI_ANNUAL | $300.00 | $600 | Two $300 credits per year. For prepaid Fine Hotels+Resorts & Hotel Collection bookings via Amex. 2-night minimum. Enrollment required. | nerdwallet.com |
| 2 | $400 Resy Dining Credit | **QUARTERLY** | **$100.00** | $400 | ⚠️ **CORRECTION NEEDED**: $100 per quarter, NOT $33.33/month. Must enroll. Dine at 10,000+ Resy restaurants. | nerdwallet.com |
| 3 | $300 Entertainment Credit | MONTHLY | $25.00 | $300 | $25/month toward Paramount+, YouTube Premium/TV, Peacock, Disney+, ESPN+, Hulu, WSJ, NYT. Enrollment required. | nerdwallet.com |
| 4 | $300 Lululemon Annual Credit | QUARTERLY | $75.00 | $300 | $75/quarter at Lululemon stores or online. Enrollment required. | nerdwallet.com |
| 5 | $200 Uber Annual Credit | MONTHLY | $15.00 | $200 ($15×11 + $35 Dec) | $15/month Jan-Nov, $35 in December. Unused credits don't roll over. Must select Amex as payment in Uber app. | nerdwallet.com |
| 6 | $209 CLEAR Annual Credit | FLEXIBLE_ANNUAL | $209.00 | $209 | Covers CLEAR+ membership annual cost. Enrollment required. | nerdwallet.com |
| 7 | $120 Uber One Membership Credit | FLEXIBLE_ANNUAL | $120.00 | $120 | **NEW BENEFIT** not in our DB. Auto-renewing Uber One membership credit. Enrollment required. | nerdwallet.com |
| 8 | $300 Equinox Credit | MONTHLY | $25.00 | $300 | **NEW BENEFIT** not in our DB. For Equinox gym memberships and Equinox+ app. Enrollment required. | nerdwallet.com |
| 9 | $100 Saks Fifth Avenue Credit | SEMI_ANNUAL | $50.00 | $100 | **NEW BENEFIT** not in our DB. $50 Jan-Jun, $50 Jul-Dec. In-store or online. Enrollment required. | nerdwallet.com |
| 10 | $200 Oura Ring Credit | FLEXIBLE_ANNUAL | $200.00 | $200 | **NEW BENEFIT** not in our DB. $200/year toward Oura Ring purchase. Enrollment required. | nerdwallet.com |
| 11 | $155.40 Walmart+ Credit | MONTHLY | $12.95 | $155.40 | **NEW BENEFIT** not in our DB. $12.95/month statement credit for Walmart+ membership. | nerdwallet.com |
| 12 | $200 Airline Fee Credit | FLEXIBLE_ANNUAL | $200.00 | $200 | **NOT IN OUR DB**. Single selected airline for incidental fees (bags, in-flight). NOT airfare. Enrollment required. | nerdwallet.com |
| 13 | Centurion Lounge Access | FLEXIBLE_ANNUAL | $0.00 | $0 | Access perk, no monetary cadence. Includes Centurion, Delta Sky Club (10 visits/yr), Priority Pass, Plaza Premium, Escape, Airspace. | nerdwallet.com |
| 14 | Global Entry/TSA PreCheck | ONE_TIME | $0.00 | $0 | Fee credit, reimbursement-based. Every 4-5 years. | nerdwallet.com |
| 15 | Fine Hotels & Resorts Program | FLEXIBLE_ANNUAL | $0.00 | $0 | Access perk, no monetary cadence. Room upgrades, early check-in, late checkout, breakfast, $100 property credit. | nerdwallet.com |

### Discrepancies Found:
- ❌ **$400 Resy Dining**: We had MONTHLY $33.33 → Should be **QUARTERLY $100.00** (user was correct!)
- ⚠️ Several benefits missing from our DB: Uber One ($120), Equinox ($300), Saks ($100), Oura Ring ($200), Walmart+ ($155.40), Airline Fee ($200)
- ✅ Hotel Credit SEMI_ANNUAL $300: Correct
- ✅ Entertainment MONTHLY $25: Correct
- ✅ Lululemon QUARTERLY $75: Correct
- ✅ Uber MONTHLY $15 (+$35 Dec): Correct
- ✅ CLEAR FLEXIBLE_ANNUAL $209: Correct

---

## 2. American Express Gold Card — $325 annual fee

| # | Benefit Name (in our DB) | Verified Cadence | Per-Period Amount | Annual Total | Special Rules | Source |
|---|---|---|---|---|---|---|
| 1 | $120 Annual Dining Credit | MONTHLY | $10.00 | $120 | $10/month at Grubhub, The Cheesecake Factory, Goldbelly, Wine.com, Five Guys. Enrollment required. | creditcards.com |
| 2 | $120 Uber Cash Credit | MONTHLY | $10.00 | $120 | ⚠️ **CORRECTION NEEDED**: $10/month = $120/year, NOT $8.33/month = $100/year. Must add Amex as payment. | creditcards.com |
| 3 | $100 Resy Credit | SEMI_ANNUAL | $50.00 | $100 | **NEW**: $50 semi-annually for Resy dining. Enrollment required. | creditcards.com |
| 4 | $84 Dunkin' Credit | MONTHLY | $7.00 | $84 | **NEW**: $7/month for Dunkin' purchases. Enrollment required. | creditcards.com |
| 5 | 4x Points on Dining | FLEXIBLE_ANNUAL | $0.00 | $0 | 4x MR points at restaurants worldwide, up to $50K/year. Then 1x. | creditcards.com |
| 6 | 4x Points on U.S. Supermarkets | FLEXIBLE_ANNUAL | $0.00 | $0 | 4x MR points at U.S. supermarkets, up to $25K/year. Then 1x. | creditcards.com |
| 7 | Purchase Protection | FLEXIBLE_ANNUAL | $0.00 | $0 | Up to $10K/claim, $50K/year max. Damage or theft coverage. | creditcards.com |

### Discrepancies Found:
- ❌ **Uber Credit**: We had MONTHLY $8.33 ($100/yr) → Should be **MONTHLY $10.00 ($120/yr)**. The amount AND total are wrong.
- ✅ Dining Credit MONTHLY $10: Correct
- ⚠️ Missing benefits: Resy Credit ($100 semi-annual), Dunkin' Credit ($84), 4x on Supermarkets
- ⚠️ "4x Points on Flights" listed in our DB but NOT a current Amex Gold benefit. Gold earns 3x on flights booked directly with airlines OR via amextravel.com. This may be outdated or confused with the Platinum.

---

## 3. Chase Sapphire Reserve — $550 annual fee

> **Note:** Chase increased the CSR annual fee to $795 in 2025. If our DB shows $550, that needs updating too.

| # | Benefit Name (in our DB) | Verified Cadence | Per-Period Amount | Annual Total | Special Rules | Source |
|---|---|---|---|---|---|---|
| 1 | $300 Annual Travel Credit | FLEXIBLE_ANNUAL | $300.00 | $300 | Auto-applied to broad travel purchases (Uber, taxis, trains, hotels, campgrounds, etc.). Resets per account anniversary year. | nerdwallet.com |
| 2 | $500 The Edit Hotel Credit | SEMI_ANNUAL | $250.00 | $500 | ⚠️ Two $250 credits per year for bookings at 1,000+ hotels in "The Edit" collection. | nerdwallet.com |
| 3 | $300 Dining Credit (Exclusive Tables) | SEMI_ANNUAL | $150.00 | $300 | ⚠️ Two $150 credits per year at Sapphire Reserve Exclusive Tables restaurants. | nerdwallet.com |
| 4 | $300 Entertainment Credit (StubHub/viagogo) | SEMI_ANNUAL | $150.00 | $300 | ⚠️ Two $150 credits per year for StubHub and viagogo purchases. | nerdwallet.com |
| 5 | $250 Apple TV+ & Apple Music | FLEXIBLE_ANNUAL | $250.00 | $250 | Complimentary subscriptions through 6/22/2027. | nerdwallet.com |
| 6 | $120 Lyft Credit | MONTHLY | $10.00 | $120 | $10/month Lyft credit. Plus 5x points on Lyft through 9/30/2027. | nerdwallet.com |
| 7 | $300 DoorDash Credit + $120 DashPass | MONTHLY | ~$35.00 | $420 | Monthly $5 restaurant promo + two $10 promos for groceries/beauty/electronics. Plus $120 DashPass membership. | nerdwallet.com |
| 8 | $120 Peloton Credit | MONTHLY | $10.00 | $120 | $10/month Peloton credit. | nerdwallet.com |
| 9 | $250 Hotel Chain Credit | SEMI_ANNUAL | $125.00 | $250 | Per user's listing — this may overlap with The Edit. Needs verification. | user-listed |
| 10 | Priority Pass Select | FLEXIBLE_ANNUAL | $0.00 | $0 | Access perk. Plus Chase Sapphire Lounges access. | nerdwallet.com |
| 11 | Global Entry/TSA PreCheck/NEXUS | ONE_TIME | $0.00 | $0 | Up to $120 reimbursement every 4 years. | nerdwallet.com |
| 12 | Trip Cancellation Insurance | FLEXIBLE_ANNUAL | $0.00 | $0 | Insurance perk, no monetary cadence. | nerdwallet.com |
| 13 | Lost Luggage Reimbursement | FLEXIBLE_ANNUAL | $0.00 | $0 | Insurance perk, no monetary cadence. | nerdwallet.com |

### Discrepancies Found:
- ❌ **Annual Fee**: Our DB may show $550 → Now **$795** as of 2025
- ❌ **Dining Credit**: If we set this as one cadence, it's actually **SEMI_ANNUAL $150** (Exclusive Tables program)
- ❌ **Entertainment Credit**: If we set this as monthly, it's actually **SEMI_ANNUAL $150** (StubHub/viagogo)
- ⚠️ **The Edit Hotel Credit**: SEMI_ANNUAL $250, not a single annual credit
- ⚠️ Many new benefits not in our DB: Apple TV+/Music ($250), Lyft ($120), DoorDash ($420), Peloton ($120)
- ⚠️ $75K spend tier unlocks additional $500 Southwest + $250 Shops at Chase credits

---

## 4. Chase Sapphire Preferred — $95 annual fee

| # | Benefit Name (in our DB) | Verified Cadence | Per-Period Amount | Annual Total | Special Rules | Source |
|---|---|---|---|---|---|---|
| 1 | 3x/5x Points on Travel | FLEXIBLE_ANNUAL | $0.00 | $0 | 5x through Chase Travel, 2x on other travel, 3x on dining & streaming. | nerdwallet.com |
| 2 | $50 Hotel Credit | FLEXIBLE_ANNUAL | $50.00 | $50 | Annual credit on hotel stays purchased through Chase. | nerdwallet.com |
| 3 | 10% Anniversary Bonus | FLEXIBLE_ANNUAL | $0.00 | $0 | Bonus points equal to 10% of total purchases made previous year. | nerdwallet.com |
| 4 | Trip Cancellation Insurance | FLEXIBLE_ANNUAL | $0.00 | $0 | Insurance perk. | nerdwallet.com |
| 5 | Trip Delay Reimbursement | FLEXIBLE_ANNUAL | $0.00 | $0 | Insurance perk. | nerdwallet.com |
| 6 | Emergency Medical & Dental | FLEXIBLE_ANNUAL | $0.00 | $0 | Insurance perk. | nerdwallet.com |
| 7 | Purchase Protection | FLEXIBLE_ANNUAL | $0.00 | $0 | Insurance perk. | nerdwallet.com |

### Discrepancies Found:
- ⚠️ "Ultimate Rewards Flexible Redemption" is a card feature, not a claimable benefit — should use FLEXIBLE_ANNUAL $0
- ⚠️ Missing $50 annual hotel credit from our DB
- ✅ Insurance perks are correctly non-monetary

---

## 5. Chase Ink Preferred Business — $95 annual fee

| # | Benefit Name (in our DB) | Verified Cadence | Per-Period Amount | Annual Total | Special Rules | Source |
|---|---|---|---|---|---|---|
| 1 | 3x Points on Business Purchases | FLEXIBLE_ANNUAL | $0.00 | $0 | 3x on first $150K in combined purchases per year on travel, shipping, internet/cable/phone, advertising with social media & search engines. | chase.com (known terms) |
| 2 | Business Expense Tracking | FLEXIBLE_ANNUAL | $0.00 | $0 | Card feature, not claimable. | chase.com |
| 3 | Purchase Protection | FLEXIBLE_ANNUAL | $0.00 | $0 | Up to $10K/claim, covers damage & theft for 120 days. | chase.com |
| 4 | Cell Phone Protection | FLEXIBLE_ANNUAL | $0.00 | $0 | Up to $600/claim when you pay phone bill with card. | chase.com |

### Discrepancies Found:
- ✅ All non-monetary perks — no cadence changes needed
- ⚠️ Missing cell phone protection benefit

---

## 6. Chase Southwest Rapid Rewards Premier — $149 annual fee

| # | Benefit Name (in our DB) | Verified Cadence | Per-Period Amount | Annual Total | Special Rules | Source |
|---|---|---|---|---|---|---|
| 1 | Free Checked Bags | FLEXIBLE_ANNUAL | $0.00 | $0 | Southwest already doesn't charge for checked bags (2 free for all passengers). This is a Southwest airline feature, not a card-specific perk. | southwest.com |
| 2 | 2x Points on Southwest Flights | FLEXIBLE_ANNUAL | $0.00 | $0 | Earn 2x Rapid Rewards points on Southwest purchases. | chase.com |
| 3 | 7,500 Anniversary Points | FLEXIBLE_ANNUAL | $0.00 | $0 | Earn 7,500 anniversary points each cardmember year. | chase.com |
| 4 | Complimentary Boarding | FLEXIBLE_ANNUAL | $0.00 | $0 | EarlyBird Check-In equivalent not included — this may be incorrect in our DB. Card gives priority boarding in some tiers. | chase.com |

### Discrepancies Found:
- ⚠️ "Free Checked Bags" is misleading — Southwest offers free bags to ALL passengers regardless of card
- ⚠️ Missing 7,500 anniversary points benefit
- ⚠️ "Complimentary Boarding" — verify this is actually a benefit of this card vs. a higher-tier card

---

## 7. Chase Hyatt Credit Card — $95 annual fee

| # | Benefit Name (in our DB) | Verified Cadence | Per-Period Amount | Annual Total | Special Rules | Source |
|---|---|---|---|---|---|---|
| 1 | Free Night Award | FLEXIBLE_ANNUAL | $0.00 | $0 | One free night (up to Category 4) on card anniversary. Additional free night after $15K spend. | chase.com (known terms) |
| 2 | 4x Points on Hyatt Hotels | FLEXIBLE_ANNUAL | $0.00 | $0 | 4x points on Hyatt purchases, 2x on dining, fitness, airlines. | chase.com |
| 3 | 5 Elite Night Credits | FLEXIBLE_ANNUAL | $0.00 | $0 | 5 tier-qualifying night credits toward Hyatt elite status annually. Additional 2 credits per $5K spent. | chase.com |

### Discrepancies Found:
- ✅ All correct as non-monetary access/reward perks
- ⚠️ Clarify free night is "up to Category 4" (not unlimited)
- ⚠️ Elite Night Credits are 5 (not just "credits" generically)

---

## 8. American Express Green Card — $150 annual fee

| # | Benefit Name (in our DB) | Verified Cadence | Per-Period Amount | Annual Total | Special Rules | Source |
|---|---|---|---|---|---|---|
| 1 | 3x Points on Travel | FLEXIBLE_ANNUAL | $0.00 | $0 | 3x MR points on travel including flights, hotels, transit, taxis. | nerdwallet.com |
| 2 | 3x Points on Dining | FLEXIBLE_ANNUAL | $0.00 | $0 | 3x MR points at restaurants worldwide. | amex.com (known terms) |
| 3 | 1x on All Other | FLEXIBLE_ANNUAL | $0.00 | $0 | Standard 1x earn rate. | amex.com |
| 4 | CLEAR+ Credit | FLEXIBLE_ANNUAL | $189.00 | $189 | Statement credit for CLEAR+ membership. Enrollment required. | nerdwallet.com |
| 5 | LoungeBuddy Credit | FLEXIBLE_ANNUAL | $0.00 | $0 | **Note**: This benefit may have been discontinued/changed. Verify current terms. | amex.com |

### Discrepancies Found:
- ⚠️ "Statement Credits for Travel" in our DB is vague — the primary credit is CLEAR+ ($189)
- ⚠️ Green card benefits have been simplified significantly. Verify if any dining/travel credits still exist.

---

## 9. American Express Business Gold Card — $375 annual fee

| # | Benefit Name (in our DB) | Verified Cadence | Per-Period Amount | Annual Total | Special Rules | Source |
|---|---|---|---|---|---|---|
| 1 | 4x Points on Top 2 Categories | FLEXIBLE_ANNUAL | $0.00 | $0 | 4x MR points on top 2 spending categories each billing cycle (from 6 eligible categories) on up to $150K/year. Then 1x. | amex.com (known terms) |
| 2 | 1x on All Other | FLEXIBLE_ANNUAL | $0.00 | $0 | Standard earn rate. | amex.com |
| 3 | 25% Points Rebate on Flights | FLEXIBLE_ANNUAL | $0.00 | $0 | 25% points back when using Pay with Points for flights through Amex Travel. Up to 250K points back/year. | amex.com |
| 4 | Business Expense Tracking | FLEXIBLE_ANNUAL | $0.00 | $0 | Card feature, not claimable. Includes year-end summaries. | amex.com |

### Discrepancies Found:
- ⚠️ "4x on Business Purchases" is inaccurate — it's 4x on the TOP 2 categories each month from a preset list
- ✅ All non-monetary perks, no cadence issue
- ⚠️ Missing 25% airline points rebate benefit

---

## 10. American Express Hilton Honors Surpass Card — $150 annual fee

| # | Benefit Name (in our DB) | Verified Cadence | Per-Period Amount | Annual Total | Special Rules | Source |
|---|---|---|---|---|---|---|
| 1 | Free Night Award Certificate | FLEXIBLE_ANNUAL | $0.00 | $0 | One free night reward after spending $15K on card in a calendar year. Room up to standard reward night. | amex.com (known terms) |
| 2 | 12x Points on Hilton | FLEXIBLE_ANNUAL | $0.00 | $0 | 12x Hilton Honors points on Hilton purchases. 6x on restaurants, supermarkets, gas. 3x on other. | amex.com |
| 3 | Complimentary Gold Status | FLEXIBLE_ANNUAL | $0.00 | $0 | Automatic Hilton Honors Gold status. Upgrades to Diamond after $40K spend. | amex.com |
| 4 | Priority Pass Select | FLEXIBLE_ANNUAL | $0.00 | $0 | 10 complimentary Priority Pass lounge visits per year. | amex.com |

### Discrepancies Found:
- ❌ **Points multiplier**: Our DB says "10x" → Should be **12x** on Hilton (updated benefit)
- ⚠️ "Complimentary Room Upgrades" in our DB → This is part of Gold status, not a separate benefit
- ⚠️ "Airline Fee Credit" listed in our DB → The Surpass does NOT have an airline fee credit. This may be confused with the Aspire card ($250 airline fee credit). **Remove if present.**
- ⚠️ Free Night requires $15K spend threshold — not automatic
- ⚠️ Priority Pass has 10-visit cap

---

## 11. American Express Marriott Bonvoy Brilliant — $650 annual fee

| # | Benefit Name (in our DB) | Verified Cadence | Per-Period Amount | Annual Total | Special Rules | Source |
|---|---|---|---|---|---|---|
| 1 | Free Night Award Certificate | FLEXIBLE_ANNUAL | $0.00 | $0 | Annual free night up to 85,000 points value. With dynamic pricing, can book Category 8. | upgradedpoints.com |
| 2 | $300 Dining Credit | MONTHLY | $25.00 | $300 | Up to $25/month in statement credits for restaurant purchases worldwide. | upgradedpoints.com |
| 3 | 25 Elite Night Credits | FLEXIBLE_ANNUAL | $0.00 | $0 | 25 elite night credits at start of each year toward status. NOT redeemable for stays. | upgradedpoints.com |
| 4 | $100 Luxury Property Credit | FLEXIBLE_ANNUAL | $100.00 | $100 per stay | $100 property credit on 2+ night stays at Marriott/Ritz-Carlton/St. Regis. Available on every qualifying booking (not capped annually). | upgradedpoints.com |
| 5 | 6x Points on Marriott | FLEXIBLE_ANNUAL | $0.00 | $0 | 6x Bonvoy points on Marriott purchases, 3x on flights, 2x on other. | upgradedpoints.com |
| 6 | Priority Pass Select | FLEXIBLE_ANNUAL | $0.00 | $0 | Complimentary Priority Pass Select membership. 1,200+ lounges. | upgradedpoints.com |

### Discrepancies Found:
- ⚠️ "Airline Fee Credit" listed in our DB → The Brilliant card does **not** currently have a standalone airline fee credit. **Remove if present.**
- ✅ Dining Credit MONTHLY $25: Correct if that's what we have
- ⚠️ $100 Luxury Property Credit is per-stay (unlimited), not a capped annual benefit — cadence should be FLEXIBLE_ANNUAL
- ⚠️ Missing Priority Pass Select benefit in our DB

---

## 12. Capital One Venture X — $395 annual fee

| # | Benefit Name (in our DB) | Verified Cadence | Per-Period Amount | Annual Total | Special Rules | Source |
|---|---|---|---|---|---|---|
| 1 | $300 Annual Travel Credit | FLEXIBLE_ANNUAL | $300.00 | $300 | For bookings made through Capital One Travel portal. Auto-applied. Resets annually. | nerdwallet.com |
| 2 | 10,000 Anniversary Miles | FLEXIBLE_ANNUAL | $0.00 | $100 equivalent | 10,000 bonus miles each account anniversary (worth ~$100). First batch after 1 year. | nerdwallet.com |
| 3 | Priority Pass + Capital One Lounges | FLEXIBLE_ANNUAL | $0.00 | $0 | Access to 1,300+ Priority Pass lounges AND Capital One branded lounges (DCA, IAD, DFW, DEN, LAS, JFK). | nerdwallet.com |
| 4 | 2x Miles on All Purchases | FLEXIBLE_ANNUAL | $0.00 | $0 | 2x miles per $1 on all purchases. 5x on flights, 10x on hotels/car via Capital One Travel. | nerdwallet.com |
| 5 | Global Entry/TSA PreCheck | ONE_TIME | $0.00 | $0 | Up to $120 reimbursement every 4 years. | nerdwallet.com |
| 6 | Hertz President's Circle | FLEXIBLE_ANNUAL | $0.00 | $0 | Complimentary top-tier Hertz rental status. Upgrades, bonus points, free additional driver. | nerdwallet.com |

### Discrepancies Found:
- ❌ **"10x Miles on Travel & Dining"** in our DB → Incorrect. It's **10x on hotels/cars via portal, 5x on flights via portal, 2x on everything else**
- ⚠️ "Baggage Fee Credit" listed in our DB → Capital One Venture X does NOT have a specific baggage fee credit. **Remove if present.**
- ⚠️ Missing Hertz President's Circle and 10,000 anniversary miles benefits
- ✅ $300 Travel Credit FLEXIBLE_ANNUAL: Correct

---

## 13. Barclays JetBlue Plus Card — $99 annual fee

| # | Benefit Name (in our DB) | Verified Cadence | Per-Period Amount | Annual Total | Special Rules | Source |
|---|---|---|---|---|---|---|
| 1 | Free Checked Bag | FLEXIBLE_ANNUAL | $0.00 | $0 | First checked bag free on JetBlue flights when booked with the card. For cardholder + up to 3 companions on the same reservation. | barclays.com (known terms) |
| 2 | 3x Points on JetBlue | FLEXIBLE_ANNUAL | $0.00 | $0 | 3x TrueBlue points on JetBlue purchases, 2x on dining & grocery, 1x on other. | barclays.com |
| 3 | 50% Points Back on Inflight | FLEXIBLE_ANNUAL | $0.00 | $0 | 50% savings (points back) on inflight purchases with points. Not "free drinks & snacks" exactly. | barclays.com |
| 4 | $100 Statement Credit | FLEXIBLE_ANNUAL | $100.00 | $100 | $100 statement credit after $1K JetBlue purchase. Anniversary benefit. | barclays.com |
| 5 | 5,000 Anniversary Points | FLEXIBLE_ANNUAL | $0.00 | $0 | 5,000 bonus TrueBlue points each account anniversary. | barclays.com |

### Discrepancies Found:
- ⚠️ "Inflight Free Drinks & Snacks" → More accurately "50% points back on inflight purchases" — not truly free
- ⚠️ Missing $100 statement credit and 5,000 anniversary points

---

## 14. Citi Prestige Card — $495 annual fee

> **⚠️ IMPORTANT NOTE**: The Citi Prestige Card is **no longer open for new applications** as of 2021. Existing cardholders may retain benefits, but terms may have changed. Benefits below reflect last known terms.

| # | Benefit Name (in our DB) | Verified Cadence | Per-Period Amount | Annual Total | Special Rules | Source |
|---|---|---|---|---|---|---|
| 1 | $250 Airline Travel Credit | FLEXIBLE_ANNUAL | $250.00 | $250 | Applied to airline ticket costs or incidental fees. Previously expanded to supermarkets/restaurants (through 2022). | upgradedpoints.com |
| 2 | 5x/3x Points | FLEXIBLE_ANNUAL | $0.00 | $0 | 5x on airlines, travel agencies, dining. 3x on cruise & hotels. 1x other. | upgradedpoints.com |
| 3 | Fourth Night Free | FLEXIBLE_ANNUAL | $0.00 | $0 | Book 4 consecutive nights at ANY hotel, 4th night free as statement credit. Very valuable for travelers. | upgradedpoints.com |
| 4 | Priority Pass Select | FLEXIBLE_ANNUAL | $0.00 | $0 | Complimentary lounge access worldwide. | upgradedpoints.com |
| 5 | $120 Global Entry Credit | ONE_TIME | $0.00 | $0 | Reimbursement for Global Entry application fee. | upgradedpoints.com |
| 6 | Concierge Services | FLEXIBLE_ANNUAL | $0.00 | $0 | 24/7 global concierge team. | upgradedpoints.com |

### Discrepancies Found:
- ⚠️ Card is **discontinued for new applicants** — should we flag this in our DB?
- ❌ "Travel Credit" in our DB is vague → It's specifically a **$250 Airline Travel Credit**
- ❌ "3x Prestige Points on Travel" → More nuanced: **5x on airlines/dining, 3x on hotels/cruise**
- ✅ Fourth Night Free: Correct, this is a unique and valuable perk

---

## 15. US Bank Altitude Reserve — $400 annual fee

| # | Benefit Name (in our DB) | Verified Cadence | Per-Period Amount | Annual Total | Special Rules | Source |
|---|---|---|---|---|---|---|
| 1 | $325 Annual Travel Credit | FLEXIBLE_ANNUAL | $325.00 | $325 | ⚠️ **NOT quarterly**. It's a $325 annual travel credit applied automatically to travel purchases. Resets per cardmember year. | usbank.com (known terms) |
| 2 | 4.5x Points on Travel & Mobile Wallet | FLEXIBLE_ANNUAL | $0.00 | $0 | 3x on travel and mobile wallet purchases. Points worth 1.5x when redeemed for travel = effective 4.5x. | usbank.com |
| 3 | Priority Pass Select | FLEXIBLE_ANNUAL | $0.00 | $0 | Complimentary Priority Pass membership. Unlimited visits. | usbank.com |
| 4 | $120 Global Entry/TSA PreCheck | ONE_TIME | $0.00 | $0 | Up to $120 reimbursement. Every 4 years. | usbank.com |
| 5 | Up to $12 Streaming Credit | MONTHLY | $12.00 | $144 | Monthly statement credit for select streaming services. | usbank.com (known terms) |

### Discrepancies Found:
- ❌ **"$300 Quarterly Travel Credit"** in our DB → **WRONG**. It's **$325 ANNUAL** (FLEXIBLE_ANNUAL), not quarterly or $300
- ✅ Priority Pass Select: Correct
- ⚠️ "4.5x Points" → It's actually 3x base × 1.5x redemption multiplier. Points are earned at 3x.

---

# CORRECTIONS SUMMARY

## 🔴 Critical Corrections (Wrong cadence/amount — user will see incorrect data)

| Card | Benefit | Current (Wrong) | Correct | Change Type |
|---|---|---|---|---|
| **Amex Platinum** | $400 Resy Dining Credit | MONTHLY $33.33 | **QUARTERLY $100.00** | Cadence + Amount |
| **Amex Gold** | Uber Cash Credit | MONTHLY $8.33 ($100/yr) | **MONTHLY $10.00 ($120/yr)** | Amount (total is $120 not $100) |
| **US Bank Altitude Reserve** | Travel Credit | Assumed QUARTERLY $300 | **FLEXIBLE_ANNUAL $325.00** | Cadence + Amount |
| **Chase Sapphire Reserve** | Annual Fee | $550 | **$795** | Annual fee update |

## 🟡 Moderate Corrections (Benefit details wrong or misleading)

| Card | Benefit | Issue | Correct |
|---|---|---|---|
| **Chase Sapphire Reserve** | $300 Dining Credit | May be set as single cadence | **SEMI_ANNUAL $150** (Exclusive Tables) |
| **Chase Sapphire Reserve** | $300 Entertainment Credit | May be set as monthly | **SEMI_ANNUAL $150** (StubHub/viagogo) |
| **Chase Sapphire Reserve** | $500 The Edit Hotel Credit | May be set as annual | **SEMI_ANNUAL $250** |
| **Amex Hilton Surpass** | Points multiplier | Listed as 10x | Should be **12x** on Hilton |
| **Amex Hilton Surpass** | Airline Fee Credit | Listed in DB | **Does NOT exist** on Surpass card — remove |
| **Capital One Venture X** | Points rate | "10x on Travel & Dining" | **10x hotels/cars via portal, 5x flights, 2x all else** |
| **Capital One Venture X** | Baggage Fee Credit | Listed in DB | **Does NOT exist** — remove |
| **Citi Prestige** | Travel Credit description | "Travel Credit" (vague) | **$250 Airline Travel Credit** |
| **Amex Gold** | "4x on Flights" | Listed in DB | Not a current benefit — Gold earns 3x on flights |
| **Amex Business Gold** | "4x on Business Purchases" | Listed in DB | **4x on TOP 2 categories** each month from preset list |

## 🟢 Missing Benefits to Add

| Card | Missing Benefit | Cadence | Amount | Notes |
|---|---|---|---|---|
| **Amex Platinum** | $120 Uber One Membership | FLEXIBLE_ANNUAL | $120 | New benefit |
| **Amex Platinum** | $300 Equinox Credit | MONTHLY | $25 | Monthly credit |
| **Amex Platinum** | $100 Saks Fifth Avenue | SEMI_ANNUAL | $50 | $50 per half-year |
| **Amex Platinum** | $200 Airline Fee Credit | FLEXIBLE_ANNUAL | $200 | Single airline, incidentals |
| **Amex Platinum** | $200 Oura Ring Credit | FLEXIBLE_ANNUAL | $200 | New benefit |
| **Amex Platinum** | $155.40 Walmart+ Credit | MONTHLY | $12.95 | Monthly credit |
| **Amex Gold** | $100 Resy Credit | SEMI_ANNUAL | $50 | New benefit |
| **Amex Gold** | $84 Dunkin' Credit | MONTHLY | $7 | New benefit |
| **Amex Gold** | 4x on U.S. Supermarkets | FLEXIBLE_ANNUAL | $0 | Missing category |
| **Chase Sapphire Reserve** | $250 Apple TV+/Music | FLEXIBLE_ANNUAL | $250 | Through 6/2027 |
| **Chase Sapphire Reserve** | $120 Lyft Credit | MONTHLY | $10 | Through 9/2027 |
| **Chase Sapphire Reserve** | $420 DoorDash Credit+DashPass | MONTHLY | ~$35 | Complex monthly credits |
| **Chase Sapphire Reserve** | $120 Peloton Credit | MONTHLY | $10 | Monthly credit |
| **Chase Sapphire Preferred** | $50 Hotel Credit | FLEXIBLE_ANNUAL | $50 | Via Chase portal |
| **Capital One Venture X** | 10,000 Anniversary Miles | FLEXIBLE_ANNUAL | $0 | ~$100 value |
| **Capital One Venture X** | Hertz President's Circle | FLEXIBLE_ANNUAL | $0 | Top-tier rental status |
| **Marriott Bonvoy Brilliant** | $100 Luxury Property Credit | FLEXIBLE_ANNUAL | $100/stay | Per qualifying stay |
| **Marriott Bonvoy Brilliant** | Priority Pass Select | FLEXIBLE_ANNUAL | $0 | Lounge access |

## ⚠️ Cards Needing Special Attention

1. **Citi Prestige** — Card is **discontinued** for new applicants. Consider flagging in DB.
2. **Chase Sapphire Reserve** — Annual fee increased to $795. Many new benefits added in 2024/2025.
3. **Amex Platinum** — Significantly more benefits than our DB tracks. Consider adding the major ones.
4. **Amex Gold** — Uber credit is $120/yr (not $100), and new Resy + Dunkin' credits exist.

---

*Last verified: July 2025. Card terms change frequently — verify against issuer websites before production updates.*
