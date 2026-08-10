import { Navbar } from "@/components/layout/Navbar";
import { Hero } from "@/components/home/Hero";
import { TrustMetrics } from "@/components/home/TrustMetrics";
import { StartupDataProvider } from "@/components/home/StartupDataProvider";
import { LeaderboardPreview } from "@/components/home/LeaderboardPreview";
import { TrendingSection } from "@/components/home/TrendingSection";
import { RecentlyVerified } from "@/components/home/RecentlyVerified";
import { LiveFeed } from "@/components/home/LiveFeed";
import { WhyVerify } from "@/components/home/WhyVerify";
import { FAQ } from "@/components/home/FAQ";
import { CTA } from "@/components/home/CTA";
import { Footer } from "@/components/home/Footer";
import { getHomepageInitialData } from "@/lib/homepage-data";

export default async function HomePage() {
  const initialData = await getHomepageInitialData();

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Navbar />

      <main className="mx-auto max-w-[1080px] px-6 pb-24">
        <StartupDataProvider initialData={initialData}>
          {/* Hero Section */}
          <Hero />

          {/* Landing Page Trust Metrics - Directly Below Hero */}
          <TrustMetrics />

          {/* Dense Two-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-12">
            {/* Main Column: Leaderboard, Trending & Recently Verified */}
            <div className="lg:col-span-8 space-y-12">
              <LeaderboardPreview />
              <TrendingSection />
              <RecentlyVerified />
            </div>

            {/* Sidebar Column: Activity Feed */}
            <div className="lg:col-span-4">
              <LiveFeed />
            </div>
          </div>

          {/* Why Founders Verify */}
          <WhyVerify />

          {/* Founder FAQ */}
          <FAQ />

          {/* Bottom CTA Card */}
          <CTA />

          {/* Footer */}
          <Footer />
        </StartupDataProvider>
      </main>
    </div>
  );
}
