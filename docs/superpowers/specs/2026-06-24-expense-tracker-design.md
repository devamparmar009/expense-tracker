# Monthly Expense Tracker — Design Spec
**Date:** 2026-06-24  
**Status:** Approved

---

## Overview

A premium, self-hosted monthly expense tracker for personal use. The user sets a fixed monthly budget and tracks every expense against it, seeing a live running balance, rich analytics across months, and beautiful animated visualizations. Hosted free on GitHub Pages, installable as a PWA on mobile, with encrypted local storage for privacy.

---

## Goals

- Set a monthly budget and track spending against it in real time
- Log expenses with amount, category, note, and payment method
- View full history and trends across months
- Access from both laptop and phone (GitHub Pages + PWA)
- Keep data private via JS password gate + Web Crypto API encryption
- Look and feel premium — no flat, static UI anywhere

---

## Architecture

**Type:** Multi-page static site (vanilla HTML/CSS/JS)  
**Hosting:** GitHub Pages (free)  
**PWA:** Yes — installable on iPhone/Android home screen  
**No build step** — pure HTML/CSS/JS, deployable by pushing to GitHub

### File Structure

```
expense-tracker/
├── index.html              # Dashboard
├── expenses.html           # Expense log + add form
├── analytics.html          # Charts and trends
├── settings.html           # Budget, categories, export/import
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker (offline support)
├── css/
│   ├── main.css            # Design tokens, glassmorphism, shared components
│   └── charts.css          # Chart-specific styles
├── js/
│   ├── auth.js             # Password gate + Web Crypto encrypt/decrypt
│   ├── storage.js          # localStorage read/write + JSON export/import
│   ├── app.js              # Shared utilities, date helpers, category definitions
│   ├── dashboard.js        # Dashboard page logic
│   ├── expenses.js         # Expense form + list logic
│   ├── analytics.js        # Chart rendering (Chart.js)
│   └── settings.js         # Settings page logic
└── assets/
    ├── icon-192.png        # PWA icon
    ├── icon-512.png        # PWA icon
    └── icons/              # SVG category icons
```

### CDN Dependencies (no install)

| Library | Purpose |
|---|---|
| `Chart.js` | Bar, line, doughnut charts |
| `GSAP + ScrollTrigger` | Animations, countups, scroll reveals |
| `particles.js` | Dashboard background particle field |
| Web Crypto API (native) | AES-GCM encryption for localStorage |

---

## Security

### Two-layer protection

**Layer 1 — JS Password Gate**
- On every page load, check if a session token exists
- If not, show a full-screen password prompt before any content renders
- Wrong password = blank screen, no data exposed

**Layer 2 — Web Crypto API Encryption**
- All data in localStorage is encrypted with AES-GCM using a key derived from the user's password (PBKDF2, 100,000 iterations)
- Even if someone opens DevTools, they see only encrypted binary, not expense data
- Decryption happens in-memory on login; never stored as plaintext

**First-time setup:**
- User sets a password on first visit
- Password is used to derive an encryption key (never stored directly)
- A verification hash is stored to validate future logins

**Password change:**
- Re-encrypts all data with the new key
- Old encrypted data is replaced

**GitHub Pages note:**
- The URL is technically public but all data is client-side encrypted
- No server, no database — there is nothing to breach on the server side
- Security is entirely on-device

---

## Data Model

Stored in `localStorage` under key `etd` (encrypted blob). Decrypted shape:

```json
{
  "version": 1,
  "categories": [
    { "id": "food",          "label": "Food",          "emoji": "🍔", "color": "#FF6B6B" },
    { "id": "transport",     "label": "Transport",     "emoji": "🚗", "color": "#4ECDC4" },
    { "id": "shopping",      "label": "Shopping",      "emoji": "🛍️", "color": "#45B7D1" },
    { "id": "bills",         "label": "Bills",         "emoji": "💡", "color": "#96CEB4" },
    { "id": "health",        "label": "Health",        "emoji": "💊", "color": "#FFEAA7" },
    { "id": "entertainment", "label": "Entertainment", "emoji": "🎬", "color": "#DDA0DD" }
  ],
  "budgets": {
    "2026-06": 20000,
    "2026-05": 18000
  },
  "expenses": [
    {
      "id": "uuid-v4",
      "amount": 450,
      "categoryId": "food",
      "note": "Swiggy biryani",
      "paymentMethod": "upi",
      "date": "2026-06-24",
      "createdAt": "2026-06-24T14:30:00Z"
    }
  ]
}
```

**Payment method values:** `upi` · `cash` · `card` · `netbanking`  
**Budget key format:** `YYYY-MM` (one budget per calendar month)  
**Expense IDs:** UUID v4 generated client-side

---

## Pages & Features

### Dashboard (`index.html`)

**Hero section:**
- Animated donut ring: % of budget spent, remaining amount in center (large, bold)
- GSAP countup animation on load for all numbers
- Remaining balance styled prominently (e.g. "₹14,200 left")
- Budget and spent amounts below in smaller text

**Stat cards (3):**
- Total Spent this month
- Remaining Balance
- Days Left in month

**Top Categories (this month):**
- 3 categories with highest spend
- Mini horizontal progress bars per category, color-coded

**Recent Transactions:**
- Last 5 expenses — amount, category emoji, note, date
- Tap to expand/edit

**Quick-Add FAB:**
- Floating action button (bottom right on mobile, prominent on desktop)
- Opens slide-up modal with full expense form

---

### Expenses Log (`expenses.html`)

**Add Expense Modal (slide-up):**
- Amount field (large, numeric keyboard on mobile)
- Category selector (icon grid, not a dropdown — tap to select)
- Note field (optional, free text)
- Payment method selector (UPI / Cash / Card / Net Banking — tab-style selector)
- Date picker (defaults to today)
- Submit button with satisfying confirmation animation

**Transaction List:**
- Grouped by date (Today, Yesterday, then dates)
- Each row: category emoji + color dot · amount · note · payment method pill · edit/delete
- Swipe-to-delete on mobile
- Edit opens same slide-up modal pre-filled

**Filters:**
- Month picker (dropdown)
- Category filter (multi-select chips)
- Payment method filter
- Search bar (filters by note text)

**Month summary bar:**
- Shows total spent for selected month vs budget

---

### Analytics (`analytics.html`)

**This Month Section:**
- Budget donut (spent vs remaining) — same as dashboard
- Spending by category — horizontal bar chart, color-coded

**Trends Section:**
- Line chart: monthly total spending across last 6 months
- Month-over-month comparison table: June vs May vs April (total + per category)

**Insights Section:**
- Highest spend day this month
- Most expensive single transaction
- Payment method breakdown — donut chart (UPI % / Cash % / Card %)
- Average daily spend vs budget-per-day

---

### Settings (`settings.html`)

**Budget:**
- Set budget for current month
- View/edit past month budgets

**Categories:**
- List of all categories with emoji, label, color swatch
- Add new category (emoji picker, name, color)
- Rename / reorder / delete (with confirmation if category has expenses)

**Data:**
- Export as JSON (downloads `expense-tracker-backup-YYYY-MM-DD.json`)
- Import from JSON (with merge or replace option)
- Clear all data (double-confirm modal)

**Security:**
- Change password (re-encrypts all data)

---

## Design System

### Colors

| Token | Value | Usage |
|---|---|---|
| `--bg-primary` | `#0A0F1E` | Page background |
| `--bg-card` | `rgba(255,255,255,0.05)` | Glass cards |
| `--accent-blue` | `#4F6EF7` | Primary accent |
| `--accent-violet` | `#9B59F5` | Gradient end |
| `--accent-gradient` | `linear-gradient(135deg, #4F6EF7, #9B59F5)` | Buttons, rings, highlights |
| `--text-primary` | `#FFFFFF` | Headings |
| `--text-secondary` | `rgba(255,255,255,0.6)` | Labels, captions |
| `--border` | `rgba(255,255,255,0.08)` | Card borders |
| `--success` | `#00C896` | Positive states |
| `--danger` | `#FF4757` | Overspent, delete |

### Typography

- **Hero numbers:** `font-size: clamp(2.5rem, 8vw, 5rem)`, `font-weight: 800`, letter-spacing tight
- **Card titles:** `1.25rem`, `font-weight: 600`
- **Body:** `0.9rem`, `font-weight: 400`, `line-height: 1.6`
- **Font stack:** `'Inter'` (Google Fonts) + system fallback

### Glassmorphism Card

```css
background: rgba(255, 255, 255, 0.05);
border: 1px solid rgba(255, 255, 255, 0.08);
border-radius: 20px;
backdrop-filter: blur(20px);
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
```

### Animations

| Element | Effect |
|---|---|
| Page load | Staggered card fade-up (GSAP, 0.1s stagger) |
| Budget stats | GSAP countup from 0 on load |
| Donut ring | CSS stroke-dashoffset animation, 1.2s ease-out |
| Charts | Chart.js built-in animated draw |
| Modal open | Slide up from bottom + backdrop blur fade in |
| FAB | Pulse glow on idle, scale on hover |
| Transaction add | Row slides in from right, pushes list down |
| Transaction delete | Row slides out left + fade |
| Buttons | Gradient shift on hover, slight scale on press |
| Background | particles.js on dashboard (subtle, low opacity) |

### Navigation

**Desktop:** Top navigation bar with active indicator underline  
**Mobile:** Fixed bottom navigation bar — 4 icons (Dashboard · Expenses · Analytics · Settings)

---

## PWA Configuration

`manifest.json`:
```json
{
  "name": "Expense Tracker",
  "short_name": "Expenses",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0A0F1E",
  "theme_color": "#4F6EF7",
  "icons": [
    { "src": "assets/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "assets/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Service worker (`sw.js`) caches all static assets for offline use.

---

## Accessibility

- `prefers-reduced-motion` media query disables all GSAP + particle animations
- All form inputs have visible labels
- Color is never the only indicator (icons + text accompany color coding)
- Focus rings visible on all interactive elements
- Minimum touch target size: 44×44px on mobile

---

## Hosting & Deployment

1. Push project to a GitHub repository (can be private)
2. Enable GitHub Pages in repo Settings → Pages → source: `main` branch, root `/`
3. Site is live at `https://<username>.github.io/<repo-name>/`
4. On first visit: set your password → data begins encrypting
5. Install to phone: open in Safari/Chrome → "Add to Home Screen"

**Note:** GitHub Pages requires the repo to be public for free accounts. Data security comes from encryption, not URL obscurity.

---

## Out of Scope (not in v1)

- Cloud sync between devices (use export/import instead)
- Recurring expense templates
- Receipt photo attachments
- Multi-currency support
- Shared/family budgets
