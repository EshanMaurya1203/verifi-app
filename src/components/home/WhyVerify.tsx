import { ShieldCheck, Check } from "lucide-react";

export function WhyVerify() {
  return (
    <section className="mt-16 sm:mt-20">
      <div className="rounded-3xl border border-white/[0.06] bg-[#09090b]/40 backdrop-blur-md p-6 sm:p-8 md:p-10 shadow-xl ring-1 ring-white/[0.02]">
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
          <h2 className="font-syne text-2xl sm:text-3xl font-black text-white tracking-tight">
            Why founders verify with Verifii
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-neutral-400 font-medium">
            Automated revenue verification compared to traditional self-reported methods.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {/* Screenshots */}
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-neutral-500" />
                <h3 className="font-syne text-base font-bold text-neutral-300">
                  Screenshots
                </h3>
              </div>
              <ul className="space-y-3 text-xs sm:text-sm text-neutral-400">
                <li className="flex items-start gap-2.5">
                  <span className="text-neutral-600 mt-0.5">•</span>
                  <span>Can be edited</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-neutral-600 mt-0.5">•</span>
                  <span>Static proof</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-neutral-600 mt-0.5">•</span>
                  <span>Difficult for others to verify</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-neutral-600 mt-0.5">•</span>
                  <span>Manual sharing</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Verifii Verification */}
          <div className="rounded-2xl border border-primary/20 bg-primary/[0.02] p-6 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
            <div>
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <h3 className="font-syne text-base font-bold text-white">
                  Verifii Verification
                </h3>
              </div>
              <ul className="space-y-3 text-xs sm:text-sm text-neutral-200">
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <span>Verified using connected payment providers</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <span>Continuously trustworthy</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <span>Public trust profile</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <span>Easy to share confidently</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
