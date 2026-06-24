# Design — Expense Tracker

A locked design system for this app. Every page redesign reads this file before
emitting code. Do not regenerate per page — extend or amend this file when the
system needs to grow.

## Genre
atmospheric (dark premium financial app)

## Macrostructure family
All four pages are **app pages** — they share the **Workbench** macrostructure:
a focused working surface (hero stat → cards → lists/charts), top-bar nav on
desktop, bottom tab-bar on mobile. Pages vary only in their primary content
block, never in chrome, type, colour, or component voice.

- Dashboard: hero donut + budget → 3 stat cards → top-categories + recent
- Expenses:  month picker → summary bar → filters → grouped transaction list
- Analytics: month picker → budget donut + category bars → charts → insights → MoM table
- Settings:  budget → category manager (icon picker) → data → security

## Theme
Dark, indigo→violet accent. OKLCH throughout.

- `--color-paper`    oklch(15% 0.022 268)   — page background
- `--color-paper-2`  oklch(18% 0.028 268)   — modal / raised surface
- `--color-ink`      oklch(98% 0.004 268)   — primary text
- `--color-ink-2`    oklch(98% 0.004 268 / 0.62)
- `--color-rule`     oklch(100% 0 0 / 0.08)
- `--color-accent`   oklch(64% 0.17 268)    — indigo
- `--color-accent-2` oklch(62% 0.21 305)    — violet (gradient end)
- `--color-focus`    oklch(64% 0.17 268)
- semantic: success oklch(76% 0.15 162) · danger oklch(66% 0.2 18) · warning oklch(78% 0.15 70)

Glass surfaces are `oklch(100% 0 0 / 0.045)` with a 1px top highlight. Accent
appears as a 135° gradient on primary buttons, the donut ring, brand mark, and
active-nav state only — kept under ~5% of any viewport.

## Typography
- Display: **Sora** 700–900, roman. Used for hero numbers, page titles, stat values, section titles.
- Body: **Inter** 400–600.
- Numerals are display-weight for that "ledger" feel.
- Display tracking: -0.03em on large sizes.
- Hero number: `clamp(2.4rem, 6vw, 3.8rem)`, weight 900.

## Iconography
**No emoji anywhere.** A single inline-SVG library (`js/icons.js`, Lucide-grade,
24×24, 2px stroke, `currentColor`, round caps/joins) supplies every icon: nav,
brand mark, category chips, payment methods, and all UI affordances.

- Category icon = named key (`icon` field), rendered in a tinted rounded-square
  **chip**: `color-mix(in oklch, <cat-color> 18%, transparent)` background, icon
  stroked in the category colour.
- New categories pick from an 18-icon grid (`CATEGORY_ICON_CHOICES`) — never a text field.
- Legacy emoji data migrates to icon keys on load (`EMOJI_TO_ICON`, `migrateData`).

## Spacing
4-point named scale (`--space-*`) in `tokens.css`. Pages use named tokens.

## Motion
- Easings: `--ease-out` cubic-bezier(0.16, 1, 0.3, 1), `--ease-in-out`.
- Reveal: staggered `fadeUp` on cards; count-up on currency stats; donut ring
  draws via `stroke-dashoffset`; category bars grow width.
- Modals: slide-up on mobile, scale-in ≥600px.
- Reduced-motion: animations collapse to near-instant; donut transition removed.

## Microinteractions stance
- Silent success → small toast pill, never a blocking confirmation.
- Destructive actions (delete expense, clear data) → confirm modal.
- FAB rotates 90° on hover; buttons lift 2px; tx rows nudge 2px.

## CTA voice
- Primary: gradient fill, `--radius-sm`, icon + label, glow shadow.
- Secondary: ghost (glass + hairline border).
- Danger: tinted danger background + danger border.

## What pages MUST share
- The wallet brand mark + "Expense Tracker" wordmark.
- The indigo→violet accent and its limited placement.
- Sora display + Inter body.
- The SVG icon library and category-chip pattern.
- Nav (top-bar desktop / bottom-bar mobile) and the modal/CTA voice.

## What pages MAY differ on
- Their primary content block (donut hero vs. list vs. charts vs. forms).
- Which icons appear, per page function.

## Exports

### tokens.css
See [`tokens.css`](tokens.css) at the project root — the portable token set.

### shadcn/ui CSS variables
```css
:root {
  --background:         15% 0.022 268;
  --foreground:         98% 0.004 268;
  --primary:            64% 0.17 268;
  --primary-foreground: 99% 0.005 268;
  --muted:              18% 0.028 268;
  --muted-foreground:   98% 0.004 268;
  --border:             100% 0 0;
  --ring:               64% 0.17 268;
  --radius:             18px;
}
```
