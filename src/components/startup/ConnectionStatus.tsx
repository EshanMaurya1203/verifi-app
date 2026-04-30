"use client";

import React from "react";
import { CheckCircle2, XCircle, RefreshCw } from "lucide-react";

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
        color: "text-red-500 bg-red-50", 
        icon: XCircle,
        dot: "bg-red-500"
      };
    }
    
    // Logic: Yellow "Syncing" status if last_sync was within the last 5 minutes
    const isRecent = conn.last_sync && (Date.now() - conn.last_sync < 5 * 60 * 1000);
    if (isRecent) {
      return { 
        label: "Syncing", 
        color: "text-amber-500 bg-amber-50", 
        icon: RefreshCw,
        dot: "bg-amber-500"
      };
    }
    
    return { 
      label: "Connected", 
      color: "text-emerald-500 bg-emerald-50", 
      icon: CheckCircle2,
      dot: "bg-emerald-500"
    };
  };

  if (connections.length === 0) {
    return (
      <div className="p-8 text-center border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/50">
        <p className="text-gray-400 text-sm">No payment providers connected yet.</p>
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
            className="group relative p-5 bg-white border border-gray-100 rounded-2xl transition-all duration-200 hover:shadow-md hover:border-gray-200"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${status.dot} animate-pulse`} />
                <h3 className="text-base font-bold text-gray-900 capitalize tracking-tight">
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
                <span className="text-xs font-medium text-gray-400 uppercase tracking-widest">
                  Contribution
                </span>
                <span className="text-lg font-black text-gray-900">
                  ₹{conn.mrr.toLocaleString()}
                </span>
              </div>
              
              <div className="pt-3 border-t border-gray-50 flex justify-between items-center">
                <span className="text-[10px] font-semibold text-gray-300 uppercase tracking-wider">
                  Sync Health
                </span>
                <span className="text-[11px] font-medium text-gray-500">
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
