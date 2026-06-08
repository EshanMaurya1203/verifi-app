import type { Metadata } from "next";
import { DM_Sans, Syne, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { getSiteUrl } from "@/lib/site-url";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  weight: ["300", "400", "500"],
  subsets: ["latin"],
});

const syne = Syne({
  variable: "--font-syne",
  weight: ["700", "800"],
  subsets: ["latin"],
});

const appUrl = getSiteUrl() || "https://www.verifii.in";
const metadataBase = new URL(appUrl);

export const metadata: Metadata = {
  ...(metadataBase ? { metadataBase } : {}),
  title: {
    default: "Verifii — Verified Startup Revenue for Indian Founders",
    template: "Verifii | %s"
  },
  description:
    "The world's first verified MRR & ARR database. Connect Razorpay, Stripe, or any payment processor. Get a tamper-proof public profile.",
  openGraph: {
    title: "Verifii — Verified Startup Revenue for Indian Founders",
    description: "The world's first verified MRR & ARR database. Connect Razorpay, Stripe, or any payment processor. Get a tamper-proof public profile.",
    url: "/",
    siteName: "Verifii",
    images: [
      {
        url: "/api/og/startup/default",
        width: 1200,
        height: 630,
        alt: "Verifii Public Revenue Verification Platform",
      }
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Verifii — Verified Startup Revenue for Indian Founders",
    description: "The world's first verified MRR & ARR database. Connect Razorpay, Stripe, or any payment processor. Get a tamper-proof public profile.",
    images: ["/api/og/startup/default"],
    site: "@verifii",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "https://www.verifii.in/",
  }
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "name": "Verifii",
      "url": "https://www.verifii.in",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://www.verifii.in/search?q={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    },
    {
      "@type": "Organization",
      "name": "Verifii",
      "url": "https://www.verifii.in",
      "logo": "https://www.verifii.in/logo.png",
      "sameAs": ["https://twitter.com/verifii", "https://linkedin.com/company/verifii"]
    }
  ]
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("dark", "h-full", "bg-background", "antialiased", dmSans.variable, syne.variable, "font-sans", geist.variable)}
    >
      <body className="min-h-full">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
