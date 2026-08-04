"use client";

import { useState } from "react";
import type { FounderRecovery } from "@/lib/analytics/recovery";

interface RecoveryTableProps {
  readonly recovered: readonly FounderRecovery[];
  readonly unrecovered: readonly FounderRecovery[];
}

type TabKey = "recovered" | "unrecovered";

function formatDuration(ms: number | null): string {
  if (ms === null || ms <= 0) return "—";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round((seconds / 60) * 10) / 10;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  if (hours < 24) return `${hours}h`;
  const days = Math.round((hours / 24) * 10) / 10;
  return `${days}d`;
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

function StatusBadge({ status }: { status: "failed" | "abandoned" }) {
  const classes =
    status === "failed"
      ? "bg-rose-500/15 text-rose-400 border-rose-500/20"
      : "bg-amber-500/15 text-amber-400 border-amber-500/20";

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${classes}`}>
      {status}
    </span>
  );
}

export function RecoveryTable({ recovered, unrecovered }: RecoveryTableProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("recovered");

  const items = activeTab === "recovered" ? recovered : unrecovered;

  return (
    <div className="rounded-xl border border-white/10 bg-[#161616] p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-white">Recovery Sessions</h3>
      <p className="mt-1 text-xs text-neutral-400">
        Individual founder recovery records.
      </p>

      {/* Tabs */}
      <div className="mt-4 flex gap-1 rounded-lg bg-white/5 p-0.5">
        <button
          onClick={() => setActiveTab("recovered")}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            activeTab === "recovered"
              ? "bg-emerald-500/20 text-emerald-400"
              : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          Recovered ({recovered.length})
        </button>
        <button
          onClick={() => setActiveTab("unrecovered")}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            activeTab === "unrecovered"
              ? "bg-rose-500/20 text-rose-400"
              : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          Unrecovered ({unrecovered.length})
        </button>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-x-auto">
        {items.length === 0 ? (
          <p className="py-6 text-center text-xs text-neutral-500">
            No {activeTab} sessions in this period.
          </p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-neutral-400">
                <th className="pb-2 pr-4 font-medium">Session</th>
                <th className="pb-2 pr-4 font-medium">User</th>
                <th className="pb-2 pr-4 font-medium">Original Status</th>
                {activeTab === "recovered" && (
                  <>
                    <th className="pb-2 pr-4 font-medium">Recovered At</th>
                    <th className="pb-2 pr-4 font-medium">Recovery Time</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 50).map((item) => (
                <tr
                  key={item.sessionId}
                  className="border-b border-white/5 text-neutral-300 transition-colors hover:bg-white/[0.03]"
                >
                  <td className="py-2.5 pr-4 font-mono text-[11px] text-neutral-500">
                    {item.sessionId.length > 20
                      ? `${item.sessionId.substring(0, 20)}…`
                      : item.sessionId}
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-[11px] text-neutral-500">
                    {item.userId.length > 16
                      ? `${item.userId.substring(0, 16)}…`
                      : item.userId}
                  </td>
                  <td className="py-2.5 pr-4">
                    <StatusBadge status={item.originalStatus} />
                  </td>
                  {activeTab === "recovered" && (
                    <>
                      <td className="py-2.5 pr-4 text-neutral-400">
                        {formatTimestamp(item.recoveredAt)}
                      </td>
                      <td className="py-2.5 pr-4 text-neutral-400">
                        {formatDuration(item.recoveryDurationMs)}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {items.length > 50 && (
          <p className="mt-2 text-center text-[11px] text-neutral-500">
            Showing first 50 of {items.length} records. Export for full data.
          </p>
        )}
      </div>
    </div>
  );
}
