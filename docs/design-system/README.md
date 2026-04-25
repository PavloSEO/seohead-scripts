# SEO Site Kit — MD3 Design System

## Overview

**SEO Site Kit** is a Material Design 3 component and page-template library for content-heavy SEO websites. It targets three stacks simultaneously:

| Stack | Use case |
|---|---|
| **Next.js 15** (App Router, TypeScript, Tailwind v4) | Primary — articles, catalogs, landing pages |
| **Vite + React 19** (TypeScript, Tailwind v4) | Lightweight SPAs, glossaries, micro-sites |
| **PHP / WordPress** (ACF Pro, PostCSS Tailwind) | CMS-driven sites |

### Sources provided
- **Figma**: Material 3 Design Kit (Variables + Properties) — Community file, mounted as VFS at `/`. Three pages: Getting Started, Styles (Color Guidance, Typography, Elevation, Elements), Components (32 frames).
- No external codebase was attached.

---

## Products / Surfaces

1. **Web UI Kit** — full MD3 web component library adapted for desktop-first SEO pages (`ui_kits/web/`)
2. **Block Library** — standalone page-section blocks (Hero, CTA, Features, Testimonials, FAQ, Pricing, etc.) with 2–3 layout variants each
3. **Page Templates** — 22 full-page templates (Article, Home, Blog, Product, Catalog, Contact, etc.)

---

## CONTENT FUNDAMENTALS

### Language & Locale
- **Default locale**: Russian (`ru-RU`). English available via i18n toggle.
- Dates formatted `DD.MM.YYYY` in Russian locale.
- Country flags (ISO-3166) are the only permitted emoji-adjacent characters.

### Tone & Voice
- **Calm, factual, concise.** No marketing hyperbole, no hype adjectives ("revolutionary", "seamless", "powerful").
- Third-person neutral for labels: *"Имя"*, *"Опубликовано"*, *"Дата создания"*.
- Second-person for user actions: *"Войти"*, *"Подписаться"*, *"Отправить"*.
- Sentence case everywhere — buttons, headings, nav items. No ALL CAPS, no Title Case in Russian.
- No decorative emoji in the UI — ever.

### Copy examples (Russian)
- Button: `Отправить заявку` (not `ОТПРАВИТЬ ЗАЯВКУ` or `Отправить Заявку`)
- Heading: `Как это работает` (not `Как Это Работает`)
- Error: `Введите корректный email`
- Label: `Дата публикации`
- CTA: `Начать бесплатно`

### SEO Copy Rules
- `<title>` ≤ 60 characters
- `meta description` 140–160 characters
- One `<h1>` per page, sentence case, keyword-first
- Internal anchor text: descriptive (`/о-компании` → `О компании`), never "click here"

---

## VISUAL FOUNDATIONS

### Color System
Based on MD3 tonal palette system. **Primary accent overridden to `#1565C0`** (calm blue) from the Figma kit's default purple (`#6750A4`). All other roles follow MD3 light theme derivation.

#### Key color values (light theme)
| Token | Role | Value |
|---|---|---|
| `--md-sys-color-primary` | Primary actions, filled buttons | `#1565C0` |
| `--md-sys-color-on-primary` | Text on primary | `#FFFFFF` |
| `--md-sys-color-primary-container` | Tonal button bg, chips | `#D3E4FF` |
| `--md-sys-color-on-primary-container` | Text on primary container | `#001D36` |
| `--md-sys-color-secondary` | Secondary actions | `#525F7A` |
| `--md-sys-color-secondary-container` | Secondary chip bg | `#D9E3F9` |
| `--md-sys-color-tertiary` | Accent highlights | `#68587A` |
| `--md-sys-color-error` | Errors, destructive | `#B3261E` |
| `--md-sys-color-background` | Page background | `#FDFCFF` |
| `--md-sys-color-surface` | Card surface | `#FDFCFF` |
| `--md-sys-color-surface-container-lowest` | Whitest container | `#FFFFFF` |
| `--md-sys-color-surface-container-low` | N-96 | `#F2F0F7` |
| `--md-sys-color-surface-container` | N-94 | `#EDEAF4` |
| `--md-sys-color-surface-container-high` | N-92 | `#E7E4EE` |
| `--md-sys-color-surface-container-highest` | N-90 | `#E1DEE9` |
| `--md-sys-color-on-surface` | Primary text | `#1C1B1F` |
| `--md-sys-color-on-surface-variant` | Secondary text | `#49454F` |
| `--md-sys-color-outline` | Borders | `#79747E` |
| `--md-sys-color-outline-variant` | Dividers | `#CAC4D0` |

### Typography
**Font family: Roboto only** (no display serifs, no mono in UI).
Loaded via `next/font` in Next.js; via Google Fonts CDN import in Vite/WP.

| Scale | Size / Line-height / Tracking | Weight |
|---|---|---|
| Display Large | 57px / 64px / -0.25px | Regular 400 |
| Display Medium | 45px / 52px / 0 | Regular 400 |
| Display Small | 36px / 44px / 0 | Regular 400 |
| Headline Large | 32px / 40px / 0 | Regular 400 |
| Headline Medium | 28px / 36px / 0 | Regular 400 |
| Headline Small | 24px / 32px / 0 | Regular 400 |
| Title Large | 22px / 28px / 0 | Regular 400 |
| Title Medium | 16px / 24px / +0.15px | Medium 500 |
| Title Small | 14px / 20px / +0.1px | Medium 500 |
| Label Large | 14px / 20px / +0.1px | Medium 500 |
| Label Medium | 12px / 16px / +0.5px | Medium 500 |
| Label Small | 11px / 16px / +0.5px | Medium 500 |
| Body Large | 16px / 24px / +0.5px | Regular 400 |
| Body Medium | 14px / 20px / +0.25px | Regular 400 |
| Body Small | 12px / 16px / +0.4px | Regular 400 |

**Web overrides** (MD3 kit is mobile-first):
- Body line-height: **1.6** (not MD3's 1.4–1.5)
- Prose max-width: **720px**
- App chrome max-width: **1280px**

### Spacing Scale
`4, 8, 12, 16, 24, 32, 48, 64` px (base unit = 4px)
Web baseline padding increased 1.25× vs. MD3 kit defaults.

### Shape / Corner Radii
| Token | Value | Usage |
|---|---|---|
| `--md-sys-shape-corner-none` | 0px | Tables, dividers |
| `--md-sys-shape-corner-extra-small` | 4px | Chips (small) |
| `--md-sys-shape-corner-small` | 8px | Text fields, menus |
| `--md-sys-shape-corner-medium` | 12px | Cards |
| `--md-sys-shape-corner-large` | 16px | Sheets, dialogs |
| `--md-sys-shape-corner-extra-large` | 28px | FABs |
| `--md-sys-shape-corner-full` | 9999px | Buttons (pill), badges |

### Elevation (Light Theme)
MD3 uses tonal surface color + drop shadow. Five levels:
| Level | Surface tint opacity | Shadow |
|---|---|---|
| 0 | 0% | none |
| 1 | 5% | `0 1px 2px rgba(0,0,0,0.3), 0 1px 3px 1px rgba(0,0,0,0.15)` |
| 2 | 8% | `0 1px 2px rgba(0,0,0,0.3), 0 2px 6px 2px rgba(0,0,0,0.15)` |
| 3 | 11% | `0 4px 8px 3px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.3)` |
| 4 | 12% | `0 6px 10px 4px rgba(0,0,0,0.15), 0 2px 3px rgba(0,0,0,0.3)` |
| 5 | 14% | `0 8px 12px 6px rgba(0,0,0,0.15), 0 4px 4px rgba(0,0,0,0.3)` |

Cards use **Elevation 1** at rest, **Elevation 2** on hover.

### Backgrounds & Surfaces
- Page background: flat `#FDFCFF` — **no full-bleed images, no gradients, no textures** in chrome.
- Cards: white (`#FFFFFF`) or `surface-container-low` with subtle shadow.
- Section backgrounds: alternate between `background` and `surface-container-low`.
- No dark mode, no `prefers-color-scheme` queries.

### Interactions & Animation
- **Hover**: primary buttons darken via 8% black overlay (state layer). Cards elevate from Level 1 → Level 2.
- **Pressed**: 12% black overlay + slight scale-down implicit in MD3 ripple.
- **Focus**: 3px focus ring using `--md-sys-color-primary` at full opacity.
- **Ripple**: MD3 default — radial spread from touch/click point, `rgba(primary, 0.12)`.
- **Transitions**: `150ms` standard easing for hover, `300ms` for open/close.
- **No bounce, no spring** — standard `cubic-bezier(0.2, 0, 0, 1)` (MD3 emphasized).
- Header shrinks from 80px → 64px on scroll with shadow appearing (250ms ease).

### Borders & Dividers
- Outlined components: `1px solid --md-sys-color-outline-variant` (`#CAC4D0`)
- Strong borders (text fields active): `2px solid --md-sys-color-primary`
- Dividers: `1px solid --md-sys-color-outline-variant`, no shadow

### Cards
- Outlined: `border: 1px solid outline-variant`, `border-radius: 12px`, no shadow
- Elevated: shadow Level 1, `border-radius: 12px`, surface-container-low bg
- Filled: `background: surface-container-highest`, `border-radius: 12px`, no border

### Imagery
- No full-bleed background images in chrome or hero.
- Article/blog: 16:9 featured image, explicit `width`/`height`, `loading="lazy"` below fold, `fetchpriority="high"` on LCP image.
- Product gallery: carousel, standard aspect ratios (1:1, 4:3).
- Color vibe: neutral, desaturated. No heavy filters or color grading.

### Iconography — see ICONOGRAPHY section below

---

## ICONOGRAPHY

- **Icon system**: Material Symbols (Google's variable icon font, replaces MD Icons).
- **CDN**: `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200`
- **Style**: Outlined, weight 400, optical size 24, fill 0 (unfilled default).
- **Size**: 24px in most UI contexts; 20px in dense contexts (chips, table cells); 48px for feature section icons.
- **No PNG icons** were found in the Figma source — kit relies exclusively on Material Symbols.
- **No emoji** used as icons in the UI.
- **No SVG sprite** — icons are rendered inline via font ligatures: `<span class="material-symbols-outlined">search</span>`.
- Flag usage: country flags via `flag-icons` CSS library or inline SVG from ISO-3166 sources.

Common icons in this system:
`search`, `menu`, `close`, `arrow_forward`, `arrow_back`, `chevron_right`, `expand_more`, `check`, `check_circle`, `star`, `star_half`, `star_border`, `person`, `settings`, `edit`, `delete`, `add`, `remove`, `share`, `download`, `upload`, `link`, `phone`, `email`, `location_on`, `calendar_today`, `schedule`, `filter_list`, `sort`, `tune`, `info`, `warning`, `error`, `help`

---

## File Index

```
README.md                          ← this file
SKILL.md                           ← agent skill descriptor
colors_and_type.css                ← all MD3 CSS custom properties + type classes
assets/                            ← icons and visual assets
preview/                           ← design system card HTML files
  colors-primary.html
  colors-neutral.html
  colors-semantic.html
  type-scale.html
  type-specimens.html
  spacing-tokens.html
  elevation.html
  shape-tokens.html
  buttons.html
  form-inputs.html
  cards.html
  chips-badges.html
  navigation.html
  feedback.html
ui_kits/
  web/
    README.md
    index.html                     ← interactive demo (article page)
    tokens.css                     ← re-exports colors_and_type.css
    Primitives.jsx                 ← Button, Badge, Chip, Avatar, Divider
    Forms.jsx                      ← TextField, Textarea, Select, Checkbox, Radio, Switch
    Navigation.jsx                 ← Header, Footer, Breadcrumbs, MegaMenu
    Cards.jsx                      ← ArticleCard, ProductCard, CaseCard
    Blocks.jsx                     ← Hero (3v), CTA (3v), Features (3v), FAQ (3v)
    Feedback.jsx                   ← Dialog, Snackbar, Toast, Tooltip
```
