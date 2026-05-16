"use client";

import React from "react";
import { CheckCircle2, XCircle, RefreshCw, Activity } from "lucide-react";

interface Connection {
  provider: string;
  connected: boolean;
  last_sync: number | null;
  mrr: number;
}

interface ConnectionStatusProps {
  connections: Connection[];
}

/**
 * ConnectionStatus Component
 * 
 * Displays a grid of payment provider connections with their current health,
 * MRR contribution, and synchronization status.
 */
export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ connections }) => {
  const [now] = React.useState(() => Date.now());

  const formatTime = (ms: number | null) => {
    if (!ms) return "Never";
    const date = new Date(ms);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatus = (conn: Connection) => {
    if (!conn.connected) {
      return { 
        label: "Monitoring", 
        color: "text-neutral-500 bg-neutral-500/10", 
        icon: Activity,
        dot: "bg-neutral-500"
      };
    }
    
    // Logic: Yellow "Syncing" status if last_sync was within the last 5 minutes
    const isRecent = conn.last_sync && (now - conn.last_sync < 5 * 60 * 1000);
    if (isRecent) {
      return { 
        label: "Syncing", 
        color: "text-amber-500 bg-amber-500/10", 
        icon: RefreshCw,
        dot: "bg-amber-500"
      };
    }
    
    return { 
      label: "Connected", 
      color: "text-emerald-500 bg-emerald-500/10", 
      icon: CheckCircle2,
      dot: "bg-emerald-500"
    };
  };

  if (connections.length === 0) {
    return (
      <div className="p-8 text-center bg-neutral-900/40 border border-white/5 rounded-[2rem]">
        <p className="text-neutral-600 text-[10px] font-black uppercase tracking-widest leading-relaxed">
          No external gateways linked to this audit
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {connections.map((conn) => {
        const status = getStatus(conn);
        const Icon = status.icon;

        return (
          <div 
            key={conn.provider} 
            className="group relative p-6 bg-neutral-900/40 border border-white/5 rounded-[2rem] transition-all duration-500 hover:border-white/10"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${status.dot} shadow-[0_0_8px_rgba(255,255,255,0.2)]`} />
                <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">
                  {conn.provider}
                </h3>
              </div>
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${status.color}`}>
                <Icon size={12} className={status.label === "Syncing" ? "animate-spin" : ""} />
                {status.label}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-[9px] font-black text-neutral-600 uppercase tracking-[0.2em]">
                  30D Volume
                </span>
                <span className="text-xl font-black text-white tabular-nums">
                  ₹{conn.mrr.toLocaleString()}
                </span>
              </div>
              
              <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                <span className="text-[9px] font-black text-neutral-700 uppercase tracking-[0.2em]">
                  Last Ping
                </span>
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                  {formatTime(conn.last_sync)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
