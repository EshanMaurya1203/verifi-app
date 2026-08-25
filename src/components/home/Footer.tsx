import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-white/[0.05] pt-6 pb-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
          © 2026 Verifii
        </div>
        <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
          <Link href="/what-is-verifii" className="hover:text-white transition-colors">
            What is Verifii?
          </Link>
          <span className="text-neutral-600">•</span>
          <Link href="/startup-revenue-verification" className="hover:text-white transition-colors">
            Startup Revenue Verification
          </Link>
          <span className="text-neutral-600">•</span>
          <Link href="/privacy" className="hover:text-white transition-colors">
            Privacy Policy
          </Link>
          <span className="text-neutral-600">•</span>
          <Link href="/terms" className="hover:text-white transition-colors">
            Terms of Service
          </Link>
          <span className="text-neutral-600">•</span>
          <span>Built for founders worldwide</span>
        </div>
      </div>
    </footer>
  );
}
