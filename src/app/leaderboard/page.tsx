"use client";

import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { supabase } from "@/lib/supabase";

type LeaderboardRow = {
  id: number;
  rank: number;
  startup_name: string;
  founder: string;
  mrr: number;
  growth_pct: number | null;
  city: string;
  verified: boolean | null;
};

function formatInr(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const fetchRows = async () => {
      setLoading(true);
      setLoadError("");

      const { data, error } = await supabase
        .from("startup_submissions")
        .select("id, startup_name, name, mrr, city")
        .order("mrr", { ascending: false });

      if (error) {
        setLoadError("Unable to load leaderboard right now.");
        setRows([]);
        setLoading(false);
        return;
      }

      const mappedRows: LeaderboardRow[] = (data ?? []).map((item, index) => ({
        id: item.id,
        rank: index + 1,
        startup_name: item.startup_name ?? "Unknown Startup",
        founder: item.name ?? "Unknown Founder",
        mrr: Number(item.mrr ?? 0),
        growth_pct: null,
        city: item.city ?? "Unknown",
        verified: true,
      }));

      setRows(mappedRows);
      setLoading(false);
    };

    fetchRows();
  }, []);

  const totalMrr = useMemo(
    () => rows.reduce((sum, row) => sum + (Number.isFinite(row.mrr) ? row.mrr : 0), 0),
    [rows]
  );
  const totalCountries = useMemo(
    () => new Set(rows.map((row) => row.city.trim()).filter(Boolean)).size,
    [rows]
  );

  return (
    <div className="min-h-screen bg-[#080808] text-[#edede9]">
      <Navbar />

      <main className="pt-20">
        <div className="mx-auto max-w-[1000px] px-6">
          <section className="mb-12 mt-12 rounded-2xl border border-[#1f1f1f] bg-[#0f0f0f]/70 p-6 shadow-[0_0_40px_rgba(185,255,75,0.08)] md:p-8">
            <h1 className="font-syne text-[40px] font-extrabold tracking-[-1.5px] text-[#edede9] md:text-[48px]">
              Top Verified Startups
            </h1>
            <p className="mt-3 max-w-[680px] text-[16px] font-light text-[#a0a09a]">
              Discover the fastest-growing verified startups ranked by revenue,
              with transparent founder and city-level insights.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-[#242424] bg-[#121212] p-5 shadow-[0_0_20px_rgba(185,255,75,0.05)]">
                <p className="text-[12px] uppercase tracking-[1px] text-[#606060]">
                  Total Startups
                </p>
                <p className="mt-2 font-syne text-[28px] font-bold text-[#edede9]">
                  {loading ? "..." : rows.length}
                </p>
              </div>
              <div className="rounded-xl border border-[#242424] bg-[#121212] p-5 shadow-[0_0_20px_rgba(185,255,75,0.08)]">
                <p className="text-[12px] uppercase tracking-[1px] text-[#606060]">
                  Total MRR
                </p>
                <p className="mt-2 font-syne text-[28px] font-bold text-[#b9ff4b]">
                  {loading ? "..." : formatInr(totalMrr)}
                </p>
              </div>
              <div className="rounded-xl border border-[#242424] bg-[#121212] p-5 shadow-[0_0_20px_rgba(185,255,75,0.05)]">
                <p className="text-[12px] uppercase tracking-[1px] text-[#606060]">
                  Countries
                </p>
                <p className="mt-2 font-syne text-[28px] font-bold text-[#edede9]">
                  {loading ? "..." : totalCountries}
                </p>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#222222] bg-[#0f0f0f] p-3">
              <input
                type="text"
                placeholder="Search startup or founder..."
                className="h-11 min-w-[220px] flex-1 rounded-lg border border-[#2a2a2a] bg-[#161616] px-4 text-[14px] text-[#edede9] placeholder:text-[#606060] outline-none transition-colors focus:border-[#3a3a3a]"
              />

              <select
                defaultValue="MRR"
                className="h-11 min-w-[150px] rounded-lg border border-[#2a2a2a] bg-[#161616] px-3 text-[14px] text-[#edede9] outline-none transition-colors focus:border-[#3a3a3a]"
                aria-label="Sort"
              >
                <option>MRR</option>
                <option>ARR</option>
              </select>

              <select
                defaultValue="All categories"
                className="h-11 min-w-[180px] rounded-lg border border-[#2a2a2a] bg-[#161616] px-3 text-[14px] text-[#edede9] outline-none transition-colors focus:border-[#3a3a3a]"
                aria-label="Category"
              >
                <option>All categories</option>
                <option>SaaS/Software</option>
                <option>Artificial Intelligence</option>
                <option>Mobile App</option>
                <option>D2C/E-commerce</option>
                <option>Content/Creator</option>
                <option>Agency/Services</option>
                <option>Developer Tools</option>
                <option>Marketing Tools</option>
              </select>

              <select
                defaultValue="All countries"
                className="h-11 min-w-[150px] rounded-lg border border-[#2a2a2a] bg-[#161616] px-3 text-[14px] text-[#edede9] outline-none transition-colors focus:border-[#3a3a3a]"
                aria-label="Country"
              >
                <option>All countries</option>
                <option>India</option>
                <option>Global</option>
              </select>
            </div>
          </section>

          <section className="w-full overflow-x-auto">
            <div className="min-w-[980px] overflow-hidden rounded-xl border border-[#1a1a1a]">
              <div className="flex w-full items-center border-b border-[#1a1a1a] bg-[#0f0f0f] px-4 py-3 text-[11px] font-medium uppercase tracking-[1px] text-[#606060]">
                <div className="w-16">#</div>
                <div className="flex-1">Startup</div>
                <div className="w-[200px]">Founder</div>
                <div className="w-[180px] text-right">MRR</div>
                <div className="w-[140px] text-right">Growth</div>
                <div className="w-[170px]">Country</div>
                <div className="w-[150px] text-right">Verified</div>
              </div>

              {loading ? (
                <div className="border-b border-[#111111] bg-[#0d0d0d] px-4 py-8 text-center text-sm text-[#606060]">
                  Loading leaderboard...
                </div>
              ) : loadError ? (
                <div className="border-b border-[#111111] bg-[#0d0d0d] px-4 py-8 text-center text-sm text-[#ff4b4b]">
                  {loadError}
                </div>
              ) : rows.length === 0 ? (
                <div className="border-b border-[#111111] bg-[#0d0d0d] px-4 py-8 text-center text-sm text-[#606060]">
                  No startups listed yet.
                </div>
              ) : (
                rows.map((row) => {
                const isTopThree = row.rank <= 3;
                const rankClassName =
                  row.rank === 1
                    ? "text-[#f5a623]"
                    : row.rank === 2
                      ? "text-[#a0a09a]"
                      : row.rank === 3
                        ? "text-[#cd7c3a]"
                        : "text-[#a0a09a]";

                return (
                  <div
                    key={row.id}
                    className={`flex w-full items-center border-b border-[#111111] px-4 py-4 transition-colors duration-150 hover:bg-[#111111] ${
                      isTopThree ? "bg-[#121212]" : "bg-[#0d0d0d]"
                    }`}
                  >
                    <div className={`w-16 font-syne text-[18px] font-bold ${rankClassName}`}>
                      {row.rank}
                    </div>
                    <div className="flex-1 text-[14px] font-medium text-[#edede9]">
                      {row.startup_name}
                    </div>
                    <div className="w-[200px] truncate pr-3 text-[14px] text-[#a0a09a]">
                      {row.founder}
                    </div>
                    <div className="w-[180px] text-right font-syne text-[16px] font-bold text-[#edede9]">
                      {formatInr(row.mrr)}
                    </div>
                    <div
                      className={`w-[140px] text-right text-[14px] font-medium ${
                        row.growth_pct !== null && row.growth_pct >= 0
                          ? "text-[#b9ff4b]"
                          : "text-[#ff4b4b]"
                      }`}
                    >
                      {row.growth_pct === null
                        ? "-"
                        : `${row.growth_pct >= 0 ? "+" : ""}${row.growth_pct.toFixed(1)}%`}
                    </div>
                    <div className="w-[170px] truncate pl-3 text-[14px] text-[#a0a09a]">
                      {row.city}
                    </div>
                    <div className="w-[150px] text-right">
                      {row.verified ? (
                        <span className="rounded-full border border-[rgba(185,255,75,0.2)] bg-[#0d1f00] px-2 py-0.5 text-[12px] text-[#b9ff4b]">
                          Verified
                        </span>
                      ) : (
                        <span className="rounded-full border border-[#2a2a2a] bg-[#171717] px-2 py-0.5 text-[12px] text-[#606060]">
                          Pending
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
