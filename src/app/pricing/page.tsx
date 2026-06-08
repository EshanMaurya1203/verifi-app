import { Navbar } from "@/components/layout/Navbar";
import { PricingTable } from "@/components/billing/PricingTable";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { getUserPlan } from "@/lib/subscriptions";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple, transparent pricing for Verifii. Get verified and build trust.",
  alternates: {
    canonical: "https://www.verifii.in/pricing/",
  }
};

export default async function PricingPage() {
  const user = await getAuthenticatedUser();
  
  let currentPlanCode = "viewer";
  let currentCycle: "monthly" | "annual" = "monthly";

  if (user) {
    const plan = await getUserPlan(user.id);
    currentPlanCode = plan.plan_code;
    currentCycle = plan.billing_cycle;
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
            Choose the right plan to verify your startup revenue and build trust with investors, partners, and customers.
          </p>
        </div>

        <PricingTable 
          currentPlanCode={currentPlanCode} 
          currentCycle={currentCycle} 
        />
        
        {/* FAQ or Trust Section could go here */}
      </main>
    </div>
  );
}
