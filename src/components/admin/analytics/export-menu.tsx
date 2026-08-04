"use client";

import { useState, useRef, useEffect } from "react";
import type { TimeRange } from "@/lib/analytics/types";
import type { ExportFormat, ExportType } from "@/lib/analytics/export";

import type { AnalyticsFilters } from "@/lib/analytics/filters";

interface ExportMenuProps {
  readonly range: TimeRange;
  readonly filters?: AnalyticsFilters;
}

interface ExportOption {
  readonly label: string;
  readonly type: ExportType;
  readonly format: ExportFormat;
}

const EXPORT_OPTIONS: readonly ExportOption[] = [
  { label: "Full report (JSON)", type: "full", format: "json" },
  { label: "Funnel (CSV)", type: "funnel", format: "csv" },
  { label: "Trends (CSV)", type: "trends", format: "csv" },
  { label: "Comparison (CSV)", type: "comparison", format: "csv" },
  { label: "Failures (CSV)", type: "failures", format: "csv" },
  { label: "Draft recovery (CSV)", type: "drafts", format: "csv" },
  { label: "Diagnostics (CSV)", type: "diagnostics", format: "csv" },
  { label: "Recovery (CSV)", type: "recovery", format: "csv" },
];

export function ExportMenu({ range, filters }: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExport = async (type: ExportType, format: ExportFormat) => {
    setIsOpen(false);
    setIsExporting(true);
    setErrorMessage(null);

    try {
      const provider = filters?.provider || "all";
      const outcome = filters?.outcome || "all";
      const url = `/api/admin/analytics/onboarding/export?format=${format}&type=${type}&range=${range}&provider=${provider}&outcome=${outcome}`;
      const res = await fetch(url);

      if (!res.ok) {
        let errJson: any = {};
        try {
          errJson = await res.json();
        } catch {
          // ignore json parse error
        }
        throw new Error(errJson.error || "Export request failed");
      }

      // Extract filename from header or fallback
      const contentDisposition = res.headers.get("Content-Disposition");
      let filename = `onboarding-${type}-${range}-${new Date().toISOString().substring(0, 10)}.${format}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Export failed. Please try again.";
      setErrorMessage(msg);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={isExporting}
        className="inline-flex items-center space-x-1.5 rounded-lg border border-white/10 bg-[#161616] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:cursor-not-allowed disabled:opacity-50"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span>{isExporting ? "Exporting..." : "Export Analytics"}</span>
        <span className="text-[10px]">▼</span>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 z-50 mt-2 w-48 rounded-lg border border-white/10 bg-[#161616] p-1 shadow-xl backdrop-blur-md"
          role="menu"
        >
          {EXPORT_OPTIONS.map((opt) => (
            <button
              key={`${opt.type}-${opt.format}`}
              onClick={() => handleExport(opt.type, opt.format)}
              className="w-full text-left rounded-md px-3 py-2 text-xs text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
              role="menuitem"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {errorMessage && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-md border border-rose-500/20 bg-rose-500/10 p-2 text-center text-xs font-medium text-rose-400 shadow-md">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
