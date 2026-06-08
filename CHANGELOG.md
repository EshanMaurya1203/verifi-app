# Changelog

## Phase 1: Branding Migration

Replaced all user-facing instances of "Verifi" with "Verifii". 

**Changes Included:**
- **Logo**: Updated the main logo text in the Navbar (`verifii`).
- **Navbar**: Updated brand references.
- **Footer**: Updated copyright text to `© 2026 Verifii`.
- **Landing Page**: Updated headings, paragraphs, and CTAs across the homepage.
- **Dashboard**: Updated empty states and tracking language.
- **Startup Profile Page**: Updated title tags, OG tags, share copy, and fallback states.
- **Empty States**: Updated index and unverified state copy in Timelines and Dashboards.
- **CTA Buttons & Error Messages**: Updated modal/form copy (e.g. submit flow requires Google auth).
- **Terms of Service & Privacy Policy**: Complete text migration to new brand name.
- **OG Images & Badges**: SVG and markup references updated for dynamic badge embeds.

**Exclusions Honored:**
- **URLs**: Support emails (`@verifi.app`) and absolute URLs remain untouched.
- **API Routes**: Endpoint routes and server-side configurations were preserved.
- **Database Schema**: No migrations or schema changes.
- **Environment Variables**: Maintained `.env` constants.
