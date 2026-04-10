import type { Metadata } from "next";
import { DM_Sans, Syne } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "Verifi — Verified startup revenue database",
  description:
    "The world's first verified MRR & ARR database. Connect Razorpay, Stripe, or any payment processor. Get a tamper-proof public profile.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${syne.variable} h-full bg-[#080808] antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
