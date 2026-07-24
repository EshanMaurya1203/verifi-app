# Verifii Brand Design System

The Verifii Brand Design System is the Single Source of Truth (SSOT) for all brand assets, design tokens, typography scales, and email configurations across the entire Verifii ecosystem.

---

## Directory Architecture

```
branding/
└── assets/                        # Official production image assets (DO NOT MODIFY)
    ├── logo-horizontal-transparent.png
    ├── logo-horizontal-solid.png
    ├── logo-square-transparent.png
    ├── logo-square-solid.png
    ├── apple-touch-icon.png
    └── favicon*.png / favicon.ico

src/lib/branding/
├── config.ts                       # Company identity, URLs, social links & asset paths
├── colors.ts                       # Centralized color tokens mapped from globals.css
├── typography.ts                   # Font scales, weights, line heights & spacing tokens
├── email.ts                        # Email branding configuration & metadata (no CSS)
├── types.ts                        # TypeScript interfaces for design system
├── index.ts                        # Barrel export (@/lib/branding)
├── design-principles.md            # Foundational design principles
├── README.md                       # Complete design system documentation
└── guidelines.md                   # Asset & design usage guidelines
```

---

## Usage in Application Code

Import branding tokens and configuration directly from `@/lib/branding`:

```typescript
import { brandConfig, brandColors, brandTypography, emailBrandConfig } from "@/lib/branding";

// Access Company Metadata
console.log(brandConfig.company.name); // "Verifii"

// Access Brand Colors
const primaryColor = brandColors.primary; // "#b9ff4b"

// Access Asset URLs
const logoUrl = brandConfig.assets.logo.horizontal.transparent;
```

---

## Core Tokens Summary

| Token | Value | Context |
| :--- | :--- | :--- |
| `primary` | `#b9ff4b` | Brand Lime Green (CTA Buttons, Badges) |
| `primaryHover` | `#a3e635` | Interactive Hover States |
| `background` | `#080808` | Application & Email Body Background |
| `surface` | `#0f0f0f` | Cards & Container Surfaces |
| `border` | `#262626` | Card & Divider Borders |
| `textPrimary` | `#f3f3f5` | Headings & High-contrast Text |
| `textSecondary`| `#a1a1aa` | Body Copy & Descriptions |
| `buttonText` | `#080808` | Text on Primary Green Buttons |

---

## Shared Consumer Systems

1. **Transactional Email Templates** (`src/emails/`)
2. **Web Application & Dashboard** (`src/app/`, `src/components/`)
3. **Open Graph & Social Previews**
4. **PDF Reports & Certificates**
5. **Future Push / Slack / Discord Notifications**

---

## Contributor Guidelines

1. **Never Hardcode Colors or URLs**: Always import from `@/lib/branding`.
2. **Preserve Production Assets**: Do not modify or replace files in `branding/assets/`.
3. **Maintain High Accessibility**: Ensure WCAG AA compliance for contrast and typography size.
