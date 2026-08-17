"use client";

import React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface LeaderboardPaginationProps {
  currentPage: number;
  totalCount: number;
  pageSize: number;
}

export function LeaderboardPagination({
  currentPage,
  totalCount,
  pageSize,
}: LeaderboardPaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  if (totalPages <= 1) {
    return null;
  }

  const navigateToPage = (newPage: number) => {
    const safePage = Math.max(1, Math.min(newPage, totalPages));
    const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
    if (safePage === 1) {
      params.delete("page");
    } else {
      params.set("page", safePage.toString());
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: true });
  };

  const fromItem = Math.min((currentPage - 1) * pageSize + 1, totalCount);
  const toItem = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 px-2 py-4 text-xs text-neutral-400">
      <div className="font-medium">
        Showing <span className="text-white font-bold">{fromItem}</span>–
        <span className="text-white font-bold">{toItem}</span> of{" "}
        <span className="text-white font-bold">{totalCount}</span> companies
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => navigateToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Previous page"
          className="flex items-center gap-1 px-3.5 py-2 bg-[#09090b]/80 border border-white/[0.08] hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Previous
        </button>

        <div className="px-3 py-2 bg-[#121216] border border-white/[0.06] rounded-xl text-neutral-300 font-bold">
          Page {currentPage} of {totalPages}
        </div>

        <button
          onClick={() => navigateToPage(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
          className="flex items-center gap-1 px-3.5 py-2 bg-[#09090b]/80 border border-white/[0.08] hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
        >
          Next
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
