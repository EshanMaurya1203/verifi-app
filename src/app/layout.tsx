import type { Metadata } from "next";
import { DM_Sans, Syne, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { getBaseUrl } from "@/lib/url";

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

const appUrl = getBaseUrl();

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Verifi — Verified Startup Revenue Database",
    template: "%s | Verifi"
  },
  description:
    "The world's first verified MRR & ARR database. Connect Razorpay, Stripe, or any payment processor. Get a tamper-proof public profile.",
  openGraph: {
    title: "Verifi — Verified Startup Revenue Database",
    description: "The world's first verified MRR & ARR database. Connect Razorpay, Stripe, or any payment processor. Get a tamper-proof public profile.",
    url: "/",
    siteName: "Verifi",
    images: [
      {
        url: "/api/og/startup/default",
        width: 1200,
        height: 630,
        alt: "Verifi Public Revenue Verification Platform",
      }
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Verifi — Verified Startup Revenue Database",
    description: "The world's first verified MRR & ARR database. Connect Razorpay, Stripe, or any payment processor. Get a tamper-proof public profile.",
    images: ["/api/og/startup/default"],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "/",
  }
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
      <body className="min-h-full">{children}</body>
    </html>
  );
}
