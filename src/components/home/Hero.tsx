import Link from "next/link";
import { ShieldCheck, Check } from "lucide-react";
import { VerifyButton } from "./VerifyButton";
import { HeroAnimationContainer, HeroAnimationItem } from "./HeroAnimation";

export function Hero() {
  return (
    <section className="pt-28 md:pt-36 pb-12 flex items-center justify-center">
      <HeroAnimationContainer className="flex flex-col items-center text-center w-full max-w-[840px]">
        {/* Trust Framing Tag */}
        <HeroAnimationItem className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/5 border border-emerald-500/10 rounded-full mb-6">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.2em]">
            Live Ecosystem Activity
          </span>
        </HeroAnimationItem>

        {/* Headline */}
        <HeroAnimationItem>
          <h1 className="font-syne text-[36px] md:text-[56px] lg:text-[64px] font-black leading-[1.05] tracking-[-1.5px] sm:tracking-[-2px] text-white">
            Verified startup revenue. <br />
            <span className="text-primary">
              Backed by payment data.
            </span>
          </h1>
        </HeroAnimationItem>

        {/* Subheadline */}
        <HeroAnimationItem>
          <p className="mt-6 max-w-[580px] text-sm md:text-base font-normal leading-relaxed text-neutral-400">
            Connect Stripe or Razorpay to verify your startup&apos;s revenue using real payment data. Earn a public trust badge and build credibility with investors, partners, and future customers—without relying on screenshots or self-reported claims.
          </p>
        </HeroAnimationItem>

        {/* Trust Bullets */}
        <HeroAnimationItem className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs md:text-sm font-medium text-neutral-200">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Revenue verified directly from payment providers</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Public startup profile with verified trust badge</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>No screenshots or self-reported revenue</span>
          </div>
        </HeroAnimationItem>

        {/* CTA Hierarchy */}
        <HeroAnimationItem className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-[480px]">
          <VerifyButton className="inline-flex h-11 w-full sm:w-auto items-center justify-center rounded-xl bg-primary px-7 text-xs font-bold uppercase tracking-wider text-primary-foreground transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(185,255,75,0.15)]">
            Verify your revenue
          </VerifyButton>
          <Link
            href="/leaderboard"
            className="inline-flex h-11 w-full sm:w-auto items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.02] px-7 text-xs font-bold uppercase tracking-wider text-neutral-300 transition-all duration-200 hover:bg-white/[0.05] hover:border-white/20 active:scale-[0.98]"
          >
            Explore Leaderboard
          </Link>
        </HeroAnimationItem>

        {/* Minimal Trust Strip */}
        <HeroAnimationItem className="mt-8 flex flex-wrap items-center justify-center gap-3 md:gap-5 text-[11px] font-medium text-neutral-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-neutral-400" />
            Stripe & Razorpay supported
          </span>
          <span className="hidden sm:inline text-neutral-700">•</span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-neutral-400" />
            Encrypted credentials
          </span>
          <span className="hidden sm:inline text-neutral-700">•</span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-neutral-400" />
            Revenue verified from payment providers
          </span>
        </HeroAnimationItem>
      </HeroAnimationContainer>
    </section>
  );
}
