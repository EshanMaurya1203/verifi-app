# AEO-004: Schema.org `sameAs` and External Social URL Safety Audit

**Project**: Verifii (`https://www.verifii.in`)  
**Workstream**: AEO-004 P0 Entity Foundation  
**Objective**: Identify all placeholder and unverified external URLs in structured data (`Schema.org`) and brand configuration, establish a strict protocol to prevent entity corruption, and define actionable replacement paths.

---

## 1. Executive Safety Rule

> [!IMPORTANT]
> **Never include unverified or speculative URLs in Schema.org `sameAs` arrays.**
> 
> Schema.org `sameAs` explicitly informs search engine and LLM knowledge graphs that the current entity is *identical* to the entity represented by the target URL. If a placeholder or unowned handle is declared in `sameAs`, search engines may merge Verifii’s entity knowledge graph with unrelated third parties, squatters, or name-colliding organizations (e.g. `verifii.io` or unrelated social accounts).

---

## 2. Inventory of External URLs in Codebase

### A. Root Layout Structured Data (`src/app/layout.tsx`)
Location: `jsonLd["@graph"][1]` (Schema.org `Organization`)

```json
{
  "@type": "Organization",
  "name": "Verifii",
  "url": "https://www.verifii.in",
  "logo": "https://www.verifii.in/logo.png",
  "description": "Verifii is a payment-backed startup revenue verification platform that helps founders verify MRR and ARR using connected payment-provider data from Stripe and Razorpay.",
  "sameAs": [
    "https://twitter.com/verifii",
    "https://linkedin.com/company/verifii"
  ]
}
```

### B. Central Brand Configuration (`src/lib/branding/config.ts`)
Location: `brandConfig.urls.social`

```typescript
social: {
  twitter: "https://twitter.com/verifii",
  linkedin: "https://linkedin.com/company/verifii",
  github: "https://github.com/verifii",
  discord: "https://discord.gg/verifii",
}
```

---

## 3. URL Verification & Risk Assessment

| URL in Codebase | Source File | Status | Entity Risk Level | Analysis & Findings |
|---|---|---|---|---|
| `https://twitter.com/verifii` | `layout.tsx`, `config.ts` | **Placeholder / Unverified** | **HIGH** | The generic `@verifii` handle on X/Twitter is either inactive, squatted, or owned by an unrelated entity. Declaring it in `sameAs` risks linking Verifii to an unowned profile. |
| `https://linkedin.com/company/verifii` | `layout.tsx`, `config.ts` | **Placeholder / Unverified** | **HIGH** | The generic `/company/verifii` URL on LinkedIn does not match an officially claimed company page for Verifii Technologies. |
| `https://github.com/verifii` | `config.ts` | **Placeholder / Unverified** | **MODERATE** | The official repository is currently located under `https://github.com/EshanMaurya1203/verifi-app`. |
| `https://discord.gg/verifii` | `config.ts` | **Placeholder / Unverified** | **LOW** | Used as an internal brand token fallback; not currently rendered in structured `sameAs` schema. |

---

## 4. Recommended Target Alignment & Action Schedule

| Asset / Profile | Current URL in Code | Recommended Official Replacement | Action Timing |
|---|---|---|---|
| **GitHub Repository** | `https://github.com/verifii` | `https://github.com/EshanMaurya1203/verifi-app` | Immediate / Verified |
| **GitHub Founder** | N/A | `https://github.com/EshanMaurya1203` | Immediate / Verified |
| **X / Twitter** | `https://twitter.com/verifii` | Official registered handle (e.g., `https://x.com/verifii_in` or founder `@EshanMaurya`) | Update only after account confirmation |
| **LinkedIn Company** | `https://linkedin.com/company/verifii` | Official registered company page URL | Update only after page creation |
| **Peerlist Company** | N/A | `https://peerlist.io/company/verifii` (upon creation) | Add in P1 after creation |

---

## 5. Decision on Codebase Changes for P0

1. **Do NOT inject speculative URLs**: In accordance with P0 instructions, we do not invent or prematurely inject untested social handles into `sameAs`.
2. **Planned P1 Action**: Once the founder officially registers and claims the canonical company profiles (LinkedIn, X, Peerlist), a single coordinated PR will update `sameAs` in `src/app/layout.tsx` and `brandConfig` in `src/lib/branding/config.ts`.
