# IMS — Visual Design System

A reference doc for continuing/extending the redesigned Inventory Management System. Give this to an AI (or a designer) alongside the `.dc.html` files so new screens stay consistent.

## 1. Concept

Warm, editorial "operator" dashboard — dark charcoal navigation, warm paper canvas, bold condensed headlines, one confident olive accent. Numbers are the hero; chrome stays quiet. Inspired by the attached Inventory360 reference: big blunt headline, line charts with soft gradient fill, plain white cards, no gradients/shadows-as-decoration, no rounded-icon-badges-with-colored-tints clichés.

## 2. Color palette

| Token | Hex / value | Usage |
|---|---|---|
| Ink | `#1c1c1a` | Sidebar background, primary headline text, primary buttons |
| Paper | `#f5f3ec` | Main content background, input fills |
| Card | `#ffffff` | Card surfaces |
| Border | `rgba(28,28,26,0.08)` | Card borders, table dividers (use `0.06` for lighter row dividers) |
| Muted text | `rgba(28,28,26,0.55)` | Secondary text, labels, subtitles |
| Accent (bright olive) | `#c9d16b` | Chart line/fill, active nav indicator, primary CTA in POS, active tab bg text color |
| Accent deep (olive, on white) | `#5f7a3d` | Links, "selling price" emphasis, success text |
| Success | bg `rgba(95,122,61,0.14)` / text `#5f7a3d` | Status badges: In Stock, Active, Paid, Received |
| Warning | bg `rgba(201,143,58,0.16)` / text `#a06c1f` | Status badges: Low Stock, Pending |
| Danger | bg `rgba(193,97,63,0.14)` / text `#b04e2c` | Status badges: Out of Stock, negative profit |
| Muted badge | bg `rgba(28,28,26,0.07)` / text `rgba(28,28,26,0.55)` | Inactive/neutral badges |

Rules:
- Never introduce a new hue. If a new status is needed, reuse success/warning/danger/muted.
- Accent olive (`#c9d16b`) is reserved for emphasis — chart lines, active states, primary CTAs. Don't use it as a body-text color on white (use the deeper `#5f7a3d` instead for contrast).
- No drop shadows for elevation — separation comes from a 1px border (`rgba(28,28,26,0.08)`) plus the ink/paper contrast.

## 3. Typography

- **Headlines:** Space Grotesk, weight 700, tight tracking (`letter-spacing: -0.01em`), tight line-height (1.1–1.2). Page titles: 34px. Dashboard hero headline: 36px. Card titles: 17–18px. KPI numbers: 26–28px, also Space Grotesk 700.
- **Body / UI:** Inter, weights 400–700. Body text 14–14.5px. Table headers: 11.5px, uppercase, letter-spacing 0.06em, weight 700, muted color. Nav labels: 13.5px, weight 500.
- Never use more than these two families. No italics, no serif.

## 4. Layout

**Outer shell / window-frame structure** — this is the signature structural trick, match it exactly:

```
BLACK OUTER SHELL (fills 100vw × 100vh, bg #1c1c1a, no rounding — it IS the viewport edge)
╭────────────────────────────────────────────────╮
│ SIDEBAR   ╭─────────────────────────────────╮  │
│ (flush,   │                                 │  │
│  no gap)  │      MAIN WINDOW (paper card)   │  │
│           │  border-radius:18px, own scroll │  │
│           ╰─────────────────────────────────╯  │
╰────────────────────────────────────────────────╯
```

- Root container: `display:flex; width:100vw; height:100vh; background:#1c1c1a` — no padding, no outer margin, no rounded corners at the viewport edge (it fills the whole screen, no gray backdrop around it).
- Sidebar (264px, flex:none) sits flush against the shell's left/top/bottom — same `#1c1c1a` background as the shell so there's no visible seam, just one continuous dark field.
- The main content is **not** flush — it's wrapped in a padding box (`padding:12px 12px 12px 0` — i.e. a black margin on top/right/bottom only, zero on the left where it meets the sidebar) containing the actual "window": a `#f5f3ec` card with `border-radius:18px`, `overflow-y:auto`, `height:100%`. This is what creates the illusion of a rounded app window floating inside a black bezel, while the sidebar reads as part of the bezel itself.
- Inside that window: `max-width:1400px; margin:0 auto; padding:44px 48px 64px` for the actual screen content.
- Card radius (KPI/table/report cards inside the window): 16px (buttons/inputs: 10px, small badges: pill/100px).
- Grid, not inline flow, for any row of cards or KPIs — always with `gap`, never manual margins.
- KPI rows: 4-up grid. Overview/summary rows: 2 or 3-up grid depending on content weight.

## 5. Sidebar / navigation

- Background `#1c1c1a`. Logo mark: 34px rounded-square in accent olive with a bold single-letter mark, plus wordmark in Space Grotesk 700.
- Nav item: icon (18px, stroke-based, 1.5px stroke, `currentColor`) + label, 10px vertical padding, 9px radius, full-width hit target.
- **Active state:** icon + label turn to paper/olive (icon `#c9d16b`, text `#f5f3ec`), plus a 3px accent bar on the far-left edge of the row. Inactive: icon/text at ~55–65% opacity paper.
- Hover (inactive rows): background `rgba(245,243,236,0.06)`.
- Footer: avatar circle (olive bg, ink initial) + name/role, then a muted terracotta "Log out" link — kept from the legacy app for continuity.

## 6. Core components

**KPI card** — white card, 22–24px padding, small muted label (+ optional 16px stroke icon at top-right), big Space Grotesk number below. Color the number, not the card, to signal status (ink default / olive success / amber warning / terracotta danger).

**Data table** — white card wrapping the whole table (header row + body), not per-row cards. Header row: `#faf9f5` fill, uppercase muted labels, 1px bottom border. Body rows: 17px vertical padding, hairline divider (`0.06` opacity), subtle `#faf9f5` hover. Status/category cells render as pill badges (see palette table); prices are right-aligned, weight 700, tabular; selling price uses the deep-olive accent color to differentiate from purchase cost.

**Toolbar** — single white card per screen holding the search input (paper-filled input, 10px radius) + a dark "Search" button; a separate primary action ("+ Add X") sits top-right of the page header in the ink-filled pill button style.

**Chart** — single SVG line + soft gradient-fill area beneath, stroke `#8fa64f` (2.5px), fill gradient from `#c9d16b` at 45% opacity to transparent. Axis labels are plain small muted text below the chart, not tick marks. No gridlines, no legend — captions are handled by adjacent stat callouts instead.

**Report/nav cards** (Reports screen) — icon in a small paper-filled rounded square, bold title, muted description, olive "VIEW →" affordance. No borders/colors beyond hover state (border turns olive).

**Settings rows** — label left, control right: either a muted value string, or a pill toggle (olive when on, ink knob; gray track + white knob when off). Grouped under card sections with a title + one-line description.

## 7. Iconography

Custom minimal line-icon set (20×20 viewBox, 1.5px stroke, round caps/joins, no fill) — one per nav item / KPI, hand-built to avoid generic icon-font look. Keep new icons in the same register: 1–3 simple geometric strokes, no detail past what reads at 16–18px.

## 8. Interaction & tone

- Prototype is a client-side single-page shell: sidebar click swaps the active screen instantly (no route transitions/animation — keep it snappy and utilitarian).
- Copy tone: direct and human ("Hi, here's what's happening in your store"), not corporate-generic ("Welcome back! Here's your business overview").
- Empty/zero states should still show real structure (e.g. POS cart pre-populated in this build to demonstrate the filled state — an actual build should also design the true empty state using the same card language).

## 9. What to avoid (anti-patterns from the old design)

- Generic default browser-blue (`#2563eb`-style) buttons/links — replaced with ink or olive.
- Colored rounded-square icon chips with a left-border accent — not used anywhere in this system.
- Overused "Inter/Roboto everywhere" look — headlines now carry a distinct condensed-bold identity via Space Grotesk.
- Gradient backgrounds or glassmorphism — flat surfaces only, separation via border + color contrast.

## 10. File map

- `IMS Redesign.dc.html` — shell: sidebar, nav state, routes to the screen components below.
- `DashboardScreen.dc.html` — home/overview.
- `TableScreen.dc.html` — generic reusable list screen (Products, Categories, Brands, Units, Sales, Purchases, Customers, Suppliers, Inventory, Expenses, Users) driven by a per-screen data map in its logic class.
- `PosScreen.dc.html` — point of sale (search, customer, cart, checkout).
- `ReportsScreen.dc.html` — report type grid.
- `SettingsScreen.dc.html` — grouped settings sections.

When adding a new list-style screen, prefer adding a new entry to `SCREENS` in `TableScreen.dc.html` over building a new table from scratch — it keeps column/badge/price styling automatically consistent.
