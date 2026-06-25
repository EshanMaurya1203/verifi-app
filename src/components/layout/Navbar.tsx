"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Menu, LogOut, LayoutDashboard, Settings, Rocket, CreditCard } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { SubscriptionStatusIndicator } from "@/components/billing/SubscriptionStatusIndicator";
import { getClientOAuthRedirect } from "@/lib/oauth-redirect";

export function Navbar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMobileOpen(false);
        setIsDropdownOpen(false);
      }
    };
    const onClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onClickOutside);

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) {
        const nowIso = new Date().toISOString();
        supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", data.user.id)
          .or(`status.in.(active,grace_period),and(status.eq.trialing,trial_end.gt.${nowIso}),and(status.eq.cancelled,current_period_end.gt.${nowIso})`)
          .order("created_at", { ascending: false })
          .then(({ data: plans }) => {
            if (plans && plans.length > 0) {
              const STATUS_PRIORITY: Record<string, number> = {
                active: 0,
                grace_period: 1,
                trialing: 2,
                cancelled: 3,
              };
              plans.sort((a, b) => {
                const pa = STATUS_PRIORITY[a.status] ?? 99;
                const pb = STATUS_PRIORITY[b.status] ?? 99;
                if (pa !== pb) return pa - pb;
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              });
              setSubscription(plans[0]);
            }
          });
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onClickOutside);
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSignIn = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsMobileOpen(false);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: process.env.NODE_ENV === "production" ? "https://www.verifii.in/auth/callback" : "http://localhost:3000/auth/callback",
      },
    });
  };

  const handleSignOut = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDropdownOpen(false);
    setIsMobileOpen(false);
    await supabase.auth.signOut();
    setUser(null);
    router.push("/");
  };

  const handleAddStartupClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsMobileOpen(false);
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    const effectiveUser = currentUser || user;
    if (effectiveUser) {
      router.push("/submit");
    } else {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: process.env.NODE_ENV === "production" ? "https://www.verifii.in/auth/callback" : "http://localhost:3000/auth/callback",
        },
      });
    }
  };

  const getAvatarInitials = () => {
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name.charAt(0).toUpperCase();
    }
    return user?.email?.charAt(0).toUpperCase() || "U";
  };

  const getAvatarUrl = () => {
    return user?.user_metadata?.avatar_url;
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-14 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-white transition-opacity hover:opacity-90"
        >
          <span className="font-syne text-[20px] font-bold tracking-tight">
            verifii
            <span className="ml-1 inline-block h-2 w-2 rounded-full bg-primary" />
          </span>
        </Link>

        <nav className="hidden items-center gap-6 sm:flex">
          <Link
            href="/leaderboard"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Leaderboard
          </Link>
          
          <Link
            href="/submit"
            onClick={handleAddStartupClick}
            className="rounded-md border border-primary bg-transparent px-4 py-1.5 text-sm font-medium text-primary transition-all duration-200 hover:bg-primary hover:text-primary-foreground"
          >
            Add your startup
          </Link>

          {subscription && (
            <SubscriptionStatusIndicator 
              planCode={subscription.plan_code} 
              status={subscription.status} 
              trialEnd={subscription.trial_end} 
            />
          )}

          {!user ? (
            <button
              onClick={handleSignIn}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign In
            </button>
          ) : (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
              >
                {getAvatarUrl() ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={getAvatarUrl()} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  getAvatarInitials()
                )}
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-xl border border-border bg-card p-1 shadow-xl outline-none animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95">
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Signed in as <br />
                    <span className="font-medium text-foreground truncate block max-w-full">
                      {user.email}
                    </span>
                  </div>
                  <div className="h-px w-full bg-border my-1" />
                  <Link
                    href="/dashboard"
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Link>
                  <Link
                    href="/dashboard"
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Rocket className="h-4 w-4" />
                    My Startups
                  </Link>
                  <Link
                    href="/dashboard"
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                  <Link
                    href="/dashboard/billing"
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <CreditCard className="h-4 w-4" />
                    Billing
                  </Link>
                  <div className="h-px w-full bg-border my-1" />
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-red-500 transition-colors hover:bg-red-500/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          )}
        </nav>

        <button
          type="button"
          onClick={() => setIsMobileOpen((v) => !v)}
          className="inline-flex items-center justify-center rounded-md p-2 text-foreground transition hover:bg-neutral-800/60 sm:hidden"
          aria-label="Open menu"
          aria-expanded={isMobileOpen}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <div
        className={`sm:hidden overflow-hidden border-b border-neutral-800 bg-background/92 backdrop-blur-xl transition-all duration-200 ${
          isMobileOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex flex-col gap-3">
            <Link
              href="/leaderboard"
              onClick={() => setIsMobileOpen(false)}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Leaderboard
            </Link>
            
            <Link
              href="/submit"
              onClick={handleAddStartupClick}
              className="inline-flex w-fit rounded-md border border-primary bg-transparent px-4 py-1.5 text-sm font-medium text-primary transition-all duration-200 hover:bg-primary hover:text-primary-foreground"
            >
              Add your startup
            </Link>

            {!user ? (
              <button
                onClick={handleSignIn}
                className="text-left text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Sign In
              </button>
            ) : (
              <>
                <div className="h-px w-full bg-border my-1" />
                <div className="text-xs text-muted-foreground">
                  Signed in as <span className="font-medium text-foreground">{user.email}</span>
                </div>
                <Link
                  href="/dashboard"
                  onClick={() => setIsMobileOpen(false)}
                  className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
                <Link
                  href="/dashboard"
                  onClick={() => setIsMobileOpen(false)}
                  className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Rocket className="h-4 w-4" />
                  My Startups
                </Link>
                <Link
                  href="/dashboard"
                  onClick={() => setIsMobileOpen(false)}
                  className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
                <Link
                  href="/dashboard/billing"
                  onClick={() => setIsMobileOpen(false)}
                  className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <CreditCard className="h-4 w-4" />
                  Billing
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 text-left text-sm text-red-500 transition-colors hover:text-red-400"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
