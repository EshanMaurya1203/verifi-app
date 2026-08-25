"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqData = [
  {
    question: "What is Verifii?",
    answer: "Verifii is a payment-backed startup revenue verification platform that helps founders verify MRR and ARR using connected payment-provider data from Stripe and Razorpay."
  },
  {
    question: "Is my revenue shown publicly?",
    answer: "Yes, your verified Monthly Recurring Revenue (MRR) and trust metrics are displayed on your public profile and leaderboard once your payment provider is connected and profile is set to public. You can toggle public visibility off anytime from your dashboard settings."
  },
  {
    question: "What data does Verifii access?",
    answer: "Verifii accesses read-only payment metrics, transaction volume, and subscription statuses from your connected payment account. We do not access or store customer card numbers, sensitive credentials, or personal payout banking details."
  },
  {
    question: "Is my payment data secure?",
    answer: "Yes, your payment integration uses restricted, read-only API credentials and official OAuth protocols. All access tokens are encrypted at rest, and Verifii cannot move funds or modify your payment provider settings."
  },
  {
    question: "How does Verifii verify revenue from Stripe and Razorpay?",
    answer: "Verifii connects directly to payment provider APIs to aggregate transaction logs and active subscription data. This automated sync calculates your MRR from completed payments rather than manual text inputs or screenshots."
  },
  {
    question: "Is Verifii free to use?",
    answer: "Verifii offers core revenue verification and public profile hosting for founders. Founders can connect payment providers, earn a verified trust badge, and showcase revenue metrics without any setup costs."
  },
  {
    question: "How is Verifii different from self-reported revenue leaderboards?",
    answer: "Unlike traditional leaderboards where revenue numbers are manually typed or screenshotted, Verifii validates data directly through automated payment provider API integrations. This ensures that public revenue claims are backed by connected payment-provider data from Stripe and Razorpay."
  },
  {
    question: "What happens if I disconnect my payment provider?",
    answer: "Disconnecting your payment provider halts automatic revenue syncs and revokes active API access. Your startup's public profile will no longer display an active verified badge, and unverified profiles are removed from public leaderboard rankings."
  },
  {
    question: "Can I remove my startup from the leaderboard?",
    answer: "Yes, you can set your profile to private or permanently delete your startup submission from your founder dashboard at any time. Toggling your profile to private immediately removes your startup from public search results and leaderboard listings."
  },
  {
    question: "How long does verification take?",
    answer: "Initial revenue verification typically takes less than two minutes after connecting your Stripe or Razorpay account. Once authorized, revenue metrics and trust scores update automatically after synchronization."
  },
  {
    question: "Can I choose what appears on my public profile?",
    answer: "Yes, founders control profile visibility settings, basic startup information, social links, and public bio details. You can also toggle your entire profile private whenever you wish to hide revenue numbers."
  }
];

export function FAQ() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  return (
    <section className="mt-16 sm:mt-20">
      {/* JSON-LD Schema for FAQPage */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqData.map((item) => ({
              "@type": "Question",
              name: item.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: item.answer,
              },
            })),
          }),
        }}
      />

      <div className="rounded-3xl border border-white/[0.06] bg-[#09090b]/40 backdrop-blur-md p-6 sm:p-8 md:p-10 shadow-xl ring-1 ring-white/[0.02]">
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
          <h2 className="font-syne text-2xl sm:text-3xl font-black text-white tracking-tight">
            Founder FAQ
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-neutral-400 font-medium">
            Everything you need to know about revenue verification, security, and profile controls.
          </p>
        </div>

        <div className="space-y-3 max-w-3xl mx-auto">
          {faqData.map((item, index) => {
            const isOpen = openFaqIndex === index;
            return (
              <div
                key={index}
                className="rounded-2xl border border-white/[0.05] bg-white/[0.015] overflow-hidden transition-all duration-200"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                  className="w-full px-5 py-4 flex items-center justify-between text-left gap-4 hover:bg-white/[0.02] transition-colors focus:outline-none focus:ring-1 focus:ring-primary/40 rounded-2xl"
                  aria-expanded={isOpen}
                >
                  <span className="font-syne text-xs sm:text-sm font-bold text-white">
                    {item.question}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-neutral-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-primary" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 pt-1 border-t border-white/[0.03] text-xs sm:text-sm text-neutral-400 leading-relaxed">
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
