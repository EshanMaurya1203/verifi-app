import { Navbar } from "@/components/layout/Navbar";
import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-indigo-500 selection:text-white">
      <Navbar />
      <main className="max-w-6xl mx-auto px-6 pt-24 pb-24">
        {/* Header Skeleton */}
        <div className="flex flex-col lg:flex-row gap-10 items-start justify-between mb-12">
          <div className="flex flex-col md:flex-row gap-8 items-start w-full">
            <div className="w-28 h-28 rounded-[2rem] bg-neutral-900 animate-pulse shrink-0" />
            <div className="flex-1 w-full space-y-4">
              <div className="h-12 w-64 bg-neutral-900 rounded-lg animate-pulse" />
              <div className="h-4 w-96 bg-neutral-900 rounded-md animate-pulse" />
              <div className="flex gap-4 pt-2">
                <div className="h-4 w-24 bg-neutral-900 rounded-md animate-pulse" />
                <div className="h-4 w-24 bg-neutral-900 rounded-md animate-pulse" />
                <div className="h-4 w-32 bg-neutral-900 rounded-md animate-pulse" />
              </div>
            </div>
          </div>
          <div className="w-full lg:w-80 h-48 rounded-[2.5rem] bg-neutral-900 animate-pulse shrink-0" />
        </div>

        {/* Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.8fr_1fr] gap-8">
          <div className="space-y-8">
            <div className="h-[400px] rounded-[2.5rem] bg-neutral-900 animate-pulse" />
            <div className="h-[300px] rounded-[2.5rem] bg-neutral-900 animate-pulse" />
          </div>
          <div className="space-y-6">
            <div className="h-[350px] rounded-[2rem] bg-neutral-900 animate-pulse" />
            <div className="h-[200px] rounded-[2rem] bg-neutral-900 animate-pulse" />
          </div>
        </div>
      </main>
    </div>
  );
}
