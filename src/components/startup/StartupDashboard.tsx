"use client";

import React, { useState, useEffect } from "react";
import { ConnectionStatus } from "./ConnectionStatus";
import { RevenueChart } from "./RevenueChart";
import { Loader2, AlertCircle, Shield, TrendingUp, Zap } from "lucide-react";

interface StartupOverview {
  startup: {
    id: string;
    name: string;
    trust_score: number;
  };
  connections: any[];
  revenue: any[];
}

/**
 * StartupDashboard Component
 * 
 * Client-side dashboard that fetches real-time infrastructure data
 * and visualizes connection health and revenue trends.
 */
export const StartupDashboard = ({ id }: { id: string }) => {
  const [data, setData] = useState<StartupOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/startup/${id}/overview`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to fetch audit data");
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      console.error("[Dashboard] Fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleSync = async () => {
    try {
      setSyncing(true);
      const res = await fetch(`/api/startup/${id}/sync`, { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      await fetchData();
    } catch (err) {
      console.error(err);
      alert("Manual sync failed. Please try again.");
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center space-y-6 bg-neutral-900/20 border border-white/5 rounded-[2rem]">
        <div className="relative">
          <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
          </div>
        </div>
        <div className="text-center space-y-1">
          <p className="text-neutral-400 text-[10px] font-black uppercase tracking-[0.3em]">Auditing Systems</p>
          <p className="text-neutral-600 text-[9px] font-bold uppercase tracking-widest">Cross-referencing payment connections...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-10 bg-red-500/5 border border-red-500/10 rounded-[2rem] flex flex-col items-center text-center space-y-4">
        <div className="p-3 bg-red-500/10 rounded-2xl">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <div>
          <p className="text-white font-black uppercase tracking-widest">Audit Interrupted</p>
          <p className="text-red-400/60 text-xs font-medium mt-1">{error || "Infrastructure unavailable"}</p>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
        >
          Retry Audit
        </button>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Connection Health */}
        <div className="xl:col-span-5 space-y-6">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-lg">
                <Shield className="w-4 h-4 text-indigo-400" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-neutral-400">Infrastructure</h3>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500/80">Live Sync</span>
              </div>
              <button 
                onClick={handleSync}
                disabled={syncing}
                className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg text-[9px] font-black uppercase tracking-widest text-indigo-400 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                {syncing ? "Syncing..." : "Sync Now"}
              </button>
            </div>
          </div>

          <div className="bg-neutral-900/30 border border-white/5 p-2 rounded-[2.5rem]">
            <ConnectionStatus connections={data.connections} />
          </div>
        </div>

        {/* Right Column: Revenue Velocity Chart */}
        <div className="xl:col-span-7 space-y-6">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-neutral-400">Revenue Stream</h3>
            </div>
            <div className="text-[9px] font-black uppercase tracking-widest text-neutral-600">
              Last 30 snapshots
            </div>
          </div>

          <div className="bg-neutral-900/30 border border-white/5 p-2 rounded-[2.5rem]">
            <RevenueChart data={data.revenue} />
          </div>
        </div>
      </div>
      
      {/* Bottom Quick Stats */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Active Gateways", val: data.connections.filter(c => c.connected).length, icon: Zap, color: "text-amber-400" },
          { label: "Trust Integrity", val: `${data.startup.trust_score}%`, icon: Shield, color: "text-indigo-400" },
        ].map((stat, i) => (
          <div key={i} className="p-4 bg-neutral-900/20 border border-white/5 rounded-2xl flex items-center gap-4">
            <div className={`p-2 bg-neutral-900 rounded-xl ${stat.color}`}>
              <stat.icon size={14} />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600">{stat.label}</p>
              <p className="text-sm font-black text-white">{stat.val}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
