import { VerifyButton } from "./VerifyButton";

export function CTA() {
  return (
    <section className="mt-28">
      <div className="rounded-[3rem] border border-white/[0.08] bg-[#09090b]/50 px-8 py-16 text-center relative overflow-hidden shadow-2xl group ring-1 ring-white/[0.01]">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
        <h2 className="font-syne text-[28px] md:text-[36px] font-black leading-tight text-white uppercase tracking-tight">
          Ready to verify your revenue?
        </h2>
        <p className="mx-auto mt-4 max-w-[500px] text-xs md:text-sm leading-relaxed text-[#8f8f97] font-medium">
          Join Verifii today and build public trust in minutes with payment-backed revenue verification from Stripe and Razorpay.
        </p>
        <VerifyButton className="mt-8 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-8 text-xs font-bold uppercase tracking-wider text-primary-foreground transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(185,255,75,0.2)]">
          Verify your startup
        </VerifyButton>
      </div>
    </section>
  );
}
