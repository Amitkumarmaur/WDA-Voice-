# Voicera — Design system

This file documents marketing UI tokens (Intercom marketing–inspired). **Implementation** lives in `src/index.css` (CSS variables + Tailwind `@theme`).

---

## Overview

Intercom's marketing canvas is a soft cream-white ground (`{colors.canvas}` ≈ #f5f1ec) — not pure white. The warmth is the brand's signal: this is editorial, calm, and product-focused, not bright SaaS. On top of the cream canvas sit white floating cards (`{colors.surface-1}`), thin hairline dividers (`{colors.hairline}`), and charcoal type (`{colors.ink}` #111111).

Display type is **Saans** — Intercom's proprietary geometric sans — set at weight 500 with measured negative letter-spacing (-2.0px on 72px display). Body type is the same family at weight 400. The single proprietary mono is **SaansMono**, used sparingly for code snippets and product UI screenshots embedded in the marketing surface.

The single chromatic accent is **Fin Orange** (`{colors.fin-orange}` #ff5600) — Intercom's AI-product brand color. It surfaces on the Fin product CTA, the Fin badge in pricing, and a few inline emphasis moments. It is NOT a system primary; the system primary is charcoal `{colors.ink}`. Intercom also maintains a small **report palette** (`{colors.report-blue}`, `{colors.report-green}`, `{colors.report-pink}`, `{colors.report-lime}`) used inside in-product analytics surfaces shown in mockups.

The page rhythm is heavy on **product mockups**: every section's payload is a high-fidelity screenshot of Intercom's product UI, framed in white cards with `{rounded.xl}` 16px corners. The marketing chrome is intentionally quiet so the product can be the protagonist.

**Key Characteristics:**
- **Cream canvas** (`{colors.canvas}` #f5f1ec) is the brand's defining surface — neither white nor gray, deliberately warm.
- Product-screenshot-led page rhythm: every section centers a product mockup card, marketing chrome stays minimal.
- **Saans** proprietary sans-serif carries the entire hierarchy; SaansMono for code-only contexts.
- **Charcoal** `{colors.ink}` (#111111) is the system primary — buttons, headlines, body type all sit on charcoal.
- **Fin Orange** (`{colors.fin-orange}` #ff5600) is the AI product color — used on the Fin CTA and Fin badge, never decoratively.
- Display tracking pulls aggressively negative (-2.0px on 72px); body stays at 0.
- Card corners stay modest at `{rounded.lg}` 12px and `{rounded.xl}` 16px — never pill-rounded; never square.

**Font substitutes (this project):** **Inter** (400/500), **JetBrains Mono** (400) for code in mockups.

## Colors

### Brand & Accent
- **Charcoal** (`{colors.ink}`): The system primary surface. Headlines, body type, primary CTA pill background — all charcoal.
- **White** (`{colors.on-primary}`): Text on charcoal CTAs; canvas of floating cards.
- **Fin Orange** (`{colors.fin-orange}`): The AI-product accent. Used on the Fin / Voice AI CTA, Fin badge, and a small set of inline emphasis moments.
- **Report Orange** (`{colors.report-orange}`): Slightly different orange for report / analytics in mockups.
- **Brand Blue** (`{colors.brand-blue}`): #0007cb — marketing illustrations.

### Surface
- **Canvas** (`{colors.canvas}`): Default page background — soft cream-white #f5f1ec.
- **Surface 1** (`{colors.surface-1}`): Pure white — floating cards.
- **Surface 2** (`{colors.surface-2}`): Slightly darker cream — startup-discount banner, alt rows.
- **Hairline** (`{colors.hairline}`): #d3cec6.
- **Hairline Soft** (`{colors.hairline-soft}`): Softer dividers (FAQ, footer).
- **Inverse Canvas** (`{colors.inverse-canvas}`): True black — testimonial / quote strip.
- **Inverse Surface 1** (`{colors.inverse-surface-1}`): Dark context hovers.

### Text
- **Ink** (`{colors.ink}`): #111111.
- **Ink Muted** (`{colors.ink-muted}`): #626260.
- **Ink Subtle** (`{colors.ink-subtle}`): #7b7b78.
- **Ink Tertiary** (`{colors.ink-tertiary}`): #9c9fa5.
- **Inverse Ink** / **Inverse Ink Muted**: Quote strip on black.

### Semantic & Report (in-product mockups)
- **Error**, **Success**, **Report Blue / Pink / Lime / Cyan** — chart and form semantics inside mockups only.

## Typography

- **Inter** (substitute for Saans): display and body. Weight 500 for display, 400 for body.
- **JetBrains Mono** (substitute for SaansMono): code in mockups only.

| Token | Size | Weight | Line Height | Letter Spacing | Use |
| --- | --- | --- | --- | --- | --- |
| `display-xl` | 72px | 500 | 1.05 | -2.0px | Hero |
| `display-lg` | 56px | 500 | 1.10 | -1.4px | Section openers |
| `display-md` | 40px | 500 | 1.15 | -0.8px | Sub-sections |
| `headline` | 28px | 500 | 1.20 | -0.5px | Banners |
| `card-title` | 22px | 500 | 1.25 | -0.3px | Cards |
| `subhead` | 20px | 400 | 1.40 | -0.2px | Lead |
| `body-lg` | 18px | 400 | 1.50 | -0.1px | Hero subhead |
| `body` | 16px | 400 | 1.50 | 0 | Default |
| `body-sm` | 14px | 400 | 1.50 | 0 | Footer |
| `caption` | 12px | 400 | 1.40 | 0 | Meta |
| `button` | 15px | 500 | 1.20 | 0 | Buttons |
| `eyebrow` | 14px | 500 | 1.30 | 0 | Section label, sentence case |
| `mono` | 13px | 400 | 1.50 | 0 | Code in mockups |

**Principles:** No mono on chrome. Eyebrow sentence case, not all-caps. Negative tracking scales with display size.

## Layout

- Base 8px. `xxs` 4 · `xs` 8 · `sm` 12 · `md` 16 · `lg` 24 · `xl` 32 · `xxl` 48 · `section` 96.
- Max content ~1280px. Card grids 3 / 2 / 1 by breakpoint.
- Whitespace: cream canvas + section spacing + white cards.

## Elevation

- No drop shadows on marketing cards. Depth = white on cream, or `hairline` border.
- Level 3: inverse black strip for quotes.

## Shapes (radius)

- `xs` 4 · `sm` 6 · `md` 8 (buttons, inputs) · `lg` 12 (cards) · `xl` 16 (mockups) · `xxl` 24 (large CTAs) · `pill` 9999 (tabs only) · `full` avatars.

## Components (reference)

- `button-primary`: ink bg, on-primary text, `rounded-md`, padding 10px 18px.
- `button-secondary`: surface-1, ink text, hairline border.
- `button-tertiary`: canvas bg, ink text.
- `button-fin`: fin-orange, on-primary — Voice AI CTA only.
- `pricing-tab-*`: pill on pricing.
- `pricing-card`, `pricing-card-featured`, `feature-card`, `product-mockup-card`, `testimonial-card`, `startup-discount-card`, `cta-banner`, `faq-row`, `top-nav`, `footer` — see implementation classes in `src/marketing/`.

## Do's and Don'ts

**Do:** Cream canvas; white cards; Fin orange only for voice AI CTA / badge; product mockups as hero; `rounded.lg` / `xl` for cards.

**Don't:** Pure white canvas; Fin as section background or generic primary; drop shadows on float cards; second display family; pill primary CTAs; all-caps eyebrows; report colors as brand surfaces; charcoal + Fin orange competing in same viewport.

## Responsive

- Breakpoints: 1440 · 1280 · 1024 · 768 · 480. Nav hamburger below 768px. Display scales down on small screens.

## Iteration

1. One component at a time, by token name.
2. Section on canvas vs lifted card first.
3. `npx @google/design.md lint DESIGN.md` when the tool is in the project.
4. Fin = product accent for Voice AI only.

## Known Gaps

Report palette in mockups only; no marketing dark mode in spec; Saans is proprietary (Inter in app).
