import { Navbar } from "@/components/layout/Navbar";
import { PricingTable } from "@/components/billing/PricingTable";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { getUserPlan } from "@/lib/subscriptions";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing | Verifii",
  description: "Revenue verification is free for founders. Upgrade to Pro for multi-gateway analytics and developer tools.",
  alternates: {
    canonical: "https://www.verifii.in/pricing/",
  }
};

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const user = await getAuthenticatedUser();
  
  let currentPlanCode = "viewer";

  if (user) {
    const plan = await getUserPlan(user.id);
    currentPlanCode = plan.plan_code;
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Navbar />
      
      <main className="mx-auto max-w-6xl px-4 pt-32 pb-24">
        <div className="text-center mb-16">
          <h1 className="font-syne text-[40px] sm:text-[56px] font-extrabold tracking-tight mb-6">
            Simple, transparent <span className="text-primary">pricing</span>
          </h1>
          <p className="text-muted-foreground text-lg sm:text-xl max-w-2xl mx-auto">
            Revenue verification is free for founders. Upgrade to Pro for advanced multi-gateway analytics, CSV export, and developer tools.
          </p>
        </div>

        <PricingTable 
          currentPlanCode={currentPlanCode} 
        />
      </main>
    </div>
  );
}
