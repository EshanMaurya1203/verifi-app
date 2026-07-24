import { notFound } from "next/navigation";
import Link from "next/link";
import { Mail, LayoutDashboard, Search, Home } from "lucide-react";
import * as React from "react";

export default function DevEmailsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // REQUIREMENT 4: Production Safety - Automatically protect all preview routes
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const templates = [
    { name: "Welcome", href: "/dev/emails/welcome" },
    { name: "Verification Completed", href: "/dev/emails/verification-completed" },
    { name: "Verification Failed", href: "/dev/emails/verification-failed" },
  ];

  return (
    <div className="flex h-screen bg-neutral-950 text-white overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-64 flex-shrink-0 border-r border-neutral-800 bg-neutral-900/50 flex flex-col">
        <div className="p-4 border-b border-neutral-800">
          <Link href="/dev/emails" className="flex items-center gap-2 font-semibold text-lg hover:text-indigo-400 transition-colors">
            <Mail className="h-5 w-5 text-indigo-500" />
            <span>Email Previews</span>
          </Link>
          <p className="text-xs text-neutral-500 mt-1">Design System & Mocks</p>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {templates.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="block px-3 py-2 text-sm text-neutral-300 rounded-md hover:bg-neutral-800 hover:text-white transition-colors"
            >
              {t.name}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-neutral-800">
          <Link href="/" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors">
            <Home className="h-4 w-4" />
            Back to App
          </Link>
        </div>
      </aside>

      {/* Main Content Area (Preview) */}
      <main className="flex-1 flex flex-col min-w-0 bg-neutral-950">
        {children}
      </main>
    </div>
  );
}
