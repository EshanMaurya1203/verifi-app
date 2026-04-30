"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Navbar } from "@/components/layout/Navbar";

export default function AdminPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("startup_submissions")
      .select("*")
      .in("verification_status", ["pending", "unverified", "proof_submitted", "api_verified"])
      .order("created_at", { ascending: false });

    setData(data || []);
    setLoading(false);
  };

  const updateStatus = async (id: number, status: string) => {
    // Optimistic UI update
    setData((currentData) => currentData.filter((item) => item.id !== id));

    await supabase
      .from("startup_submissions")
      .update({ verification_status: status })
      .eq("id", id);

    // Recalculate trust score immediately
    await fetch("/api/trust/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startup_id: id })
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main className="pt-24 pb-12 px-6">
        <div className="mx-auto max-w-[1000px]">
          <h1 className="font-syne text-[40px] font-extrabold tracking-[-1.5px] mb-8">
            Admin Moderation Queue
          </h1>

          {loading ? (
            <div className="flex h-32 items-center justify-center rounded-2xl border border-border bg-card">
              <p className="text-muted-foreground">Loading queue...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 rounded-2xl border border-border bg-card shadow-sm">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <span className="text-2xl">🎉</span>
              </div>
              <h2 className="text-xl font-syne font-bold mb-2">Inbox Zero!</h2>
              <p className="text-muted-foreground text-center">There are no pending startups requiring manual review at this time.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.map((item) => (
                <div key={item.id} className="relative rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:bg-[#111111]">
                  <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-syne text-[22px] font-bold">{item.startup_name}</h3>
                        <span className="text-xs bg-[#1A1A1C] border border-border text-muted-foreground px-2 py-1 rounded-md uppercase tracking-wider">
                          {item.verification_status}
                        </span>
                      </div>
                      <a href={item.website} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                        {item.website}
                      </a>
                    </div>

                    <div className="flex-shrink-0 bg-muted px-4 py-3 rounded-xl border border-border text-center min-w-[120px]">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">MRR</p>
                      <p className="font-syne text-xl font-bold text-white">₹{item.mrr?.toLocaleString() || 0}</p>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-border/50 grid grid-cols-2 md:grid-cols-4 gap-4 items-center">
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Fraud Score</p>
                      <p className="font-bold">{item.fraud_score ?? 0} / 100</p>
                    </div>
                    
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Risk Level</p>
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                          item.risk_level === "high"
                            ? "bg-red-500/10 text-red-500"
                            : item.risk_level === "medium"
                            ? "bg-yellow-500/10 text-yellow-500"
                            : "bg-green-500/10 text-green-500"
                        }`}
                      >
                        {item.risk_level || "low"}
                      </span>
                    </div>

                    <div className="col-span-2 flex justify-end gap-3 mt-4 md:mt-0">
                      <button 
                        onClick={() => updateStatus(item.id, "rejected")}
                        className="px-5 py-2 rounded-lg border border-[#ff4b4b]/30 bg-[#ff4b4b]/10 text-[#ff4b4b] text-sm font-semibold transition-colors hover:bg-[#ff4b4b] hover:text-white"
                      >
                        Reject
                      </button>
                      <button 
                        onClick={() => updateStatus(item.id, "verified")}
                        className="px-5 py-2 rounded-lg bg-primary text-black text-sm font-bold transition-all hover:shadow-[0_0_20px_rgba(185,255,75,0.4)]"
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
