import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Submit Startup",
  description: "Submit your startup to Verifii's verified revenue database and get your public profile.",
  alternates: {
    canonical: "https://www.verifii.in/submit/",
  }
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://www.verifii.in/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Submit Startup",
      "item": "https://www.verifii.in/submit/"
    }
  ]
};

export default function SubmitLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {children}
    </>
  );
}
