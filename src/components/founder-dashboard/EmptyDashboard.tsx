import { FolderKanban } from "lucide-react";
import Link from "next/link";

export function EmptyDashboard() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center my-12">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <FolderKanban className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="font-syne text-2xl font-bold mb-2">Welcome to Verifii</h3>
      <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
        Submit your startup to begin the verification process, prove your traction, and start building trust with investors.
      </p>
      <Link
        href="/submit"
        className="rounded-xl bg-primary px-8 py-4 text-base font-bold text-primary-foreground transition-colors hover:bg-[#a8e630]"
      >
        Submit Startup
      </Link>
    </div>
  );
}
