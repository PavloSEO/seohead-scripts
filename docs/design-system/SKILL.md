---
name: seo-site-kit-design
description: Use this skill to generate well-branded interfaces and assets for SEO Site Kit — a Material Design 3 component library for content-heavy SEO websites. Contains essential design guidelines, MD3 color tokens, Roboto typography, spacing/elevation systems, and a full web UI kit with article, home, blog, and contact page demos.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view.

If working on production code, read the rules here to become an expert in designing with this brand.

## Quick-start rules

- **Primary color**: `#1565C0` (calm blue). Override via `--md-sys-color-primary` CSS var.
- **Font**: Roboto only. Load via `next/font` (Next.js) or Google Fonts CDN (Vite/WP).
- **Background**: `#FDFCFF`. No gradients, no dark mode.
- **Border radius**: 4 / 8 / 12 / 16 / 28 / 9999px — use `--md-sys-shape-corner-*` tokens.
- **Elevation**: 5 levels via `--md-sys-elevation-*` box-shadow values.
- **Icons**: Material Symbols Outlined, 24px, weight 400.
- **Language**: Russian default, sentence case, no emoji in UI.
- **Spacing**: 4px base unit — 4, 8, 12, 16, 24, 32, 48, 64px.
- **Max widths**: 1280px app chrome, 720px article prose.
- **Cards**: Outlined (border, no shadow), Elevated (shadow lv1), Filled (surface-container-highest bg).
- **Buttons**: Filled (#1565C0), Tonal (primary-container), Outlined (border), Text, Elevated.
- **DO NOT**: use dark mode, emoji, gradients, shadcn/ui, MUI, CSS-in-JS, jQuery.

## Key files

- `colors_and_type.css` — all MD3 CSS custom properties + typescale utility classes
- `preview/` — visual preview cards for each token group and component
- `ui_kits/web/index.html` — interactive demo: article, home, blog, contact pages

If the user invokes this skill without other guidance, ask what they want to build or design, ask a few focused questions about stack (Next.js / Vite / WP), page type, and content, then act as an expert designer outputting either HTML prototypes or production-ready component code.
