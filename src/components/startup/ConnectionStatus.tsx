"use client";

import React, { useState } from "react";
import { CheckCircle2, Activity, RefreshCw, Unplug, Loader2 } from "lucide-react";
import { safeFetch } from "@/lib/safe-network";
import { toast } from "sonner";

interface Connection {
  provider: string;
  connected: boolean;
  last_sync: number | null;
  mrr: number;
}

interface ConnectionStatusProps {
  connections: Connection[];
  startupId: string;
  onDisconnect?: () => void;
}

/**
 * ConnectionStatus Component
 * 
 * Displays a grid of payment provider connections with their current health,
 * MRR contribution, and synchronization status. Includes disconnect capabilities.
 */
export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ connections, startupId, onDisconnect }) => {
  const [now] = useState(() => Date.now());
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

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
        label: "Disconnected", 
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

  const handleDisconnect = async (provider: string) => {
    if (!window.confirm(`Are you sure you want to disconnect ${provider}? Historical data will be preserved but syncing will stop.`)) return;

    setDisconnecting(provider);
    try {
      const { ok, error } = await safeFetch(`/api/startup/${startupId}/connections/${provider.toLowerCase()}`, {
        method: "DELETE"
      });
      
      if (!ok) throw error || new Error("Failed to disconnect provider");
      
      toast.success(`${provider} disconnected successfully.`);
      if (onDisconnect) {
        onDisconnect();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to disconnect provider.");
    } finally {
      setDisconnecting(null);
    }
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
              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${status.color}`}>
                  <Icon className={`w-3.5 h-3.5 translate-y-[-0.5px] ${status.label === "Syncing" ? "animate-spin" : ""}`} />
                  {status.label}
                </div>
                {conn.connected && (
                  <button
                    onClick={() => handleDisconnect(conn.provider)}
                    disabled={disconnecting === conn.provider}
                    className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-red-400/10 rounded-full transition-colors disabled:opacity-50"
                    title="Disconnect Provider"
                  >
                    {disconnecting === conn.provider ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Unplug className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
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
