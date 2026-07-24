# Verifii Brand Usage & Implementation Guidelines

Detailed operational guidelines for consuming brand logos, icons, color tokens, and typography across channels.

---

## 1. Logo Selection & Sizing

### Horizontal Transparent Logo (`logo-horizontal-transparent.png`)
- **Primary Use Case**: Navbars, email headers, website headers, PDF headers, landing page headers.
- **Background Context**: Dark backgrounds (`#080808`, `#0f0f0f`) or colored surface containers.
- **Recommended Display Sizes**:
  - Email Header: `170px` width (auto height)
  - Web Navbar: `140px`–`160px` width
  - PDF Header: `180px` width
- **Minimum Clear Space**: Maintain at least `16px` padding around the horizontal logo.

### Horizontal Solid Logo (`logo-horizontal-solid.png`)
- **Primary Use Case**: Print, fallback standalone banners, high-contrast container boxes.

### Square Transparent Logo (`logo-square-transparent.png`)
- **Primary Use Case**: Avatars, social profile icons, square app icons, mobile notifications.
- **Recommended Display Sizes**:
  - Small Avatar: `32px` × `32px`
  - Medium Icon: `48px` × `48px`
  - Large Icon: `96px` × `96px`

### Square Solid Logo (`logo-square-solid.png`)
- **Primary Use Case**: App launchers, favicons, app store listings.

---

## 2. Prohibited Logo Modifications

Never attempt any of the following on official Verifii assets:
- ❌ Do NOT stretch or alter aspect ratio.
- ❌ Do NOT crop or trim logo bounds.
- ❌ Do NOT recolor, tint, or apply color overlays.
- ❌ Do NOT add drop shadows, outer glows, or stroke effects.
- ❌ Do NOT rotate or skew logo angles.

---

## 3. Color Usage Rules

- **Brand Green (`#b9ff4b`)**: Use exclusively for key actions (Primary Buttons, Active Badges, Verification Highlights).
- **Background (`#080808`)**: Deep background for full-screen web views and email body wrapper.
- **Surface (`#0f0f0f`)**: Container cards, dialogs, and email content cards.
- **Borders (`#262626` / `rgba(255,255,255,0.08)`)**: Subtle structural division lines.

---

## 4. Email-Specific Guidelines

- All transactional email headers must render `logo-horizontal-transparent.png` centered at approximately `170px` width.
- CTA buttons must be styled in Brand Green (`#b9ff4b`) with dark text (`#080808`) and rounded corners (`8px`).
- Footers must include CAN-SPAM text ("You're receiving this email because you have a Verifii account."), legal copyright, and links to Privacy and Terms.
