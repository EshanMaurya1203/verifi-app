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
  verification_status: string;
  confidence_score: number;
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
        .select("id, startup_name, name, mrr, city, verification_status, confidence_score")
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
        verification_status: item.verification_status ?? "pending",
        confidence_score: item.confidence_score ?? 0,
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
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main className="pt-20">
        <div className="mx-auto max-w-[1000px] px-6">
          <section className="mb-12 mt-12 rounded-2xl border border-border bg-card p-6 shadow-[0_0_40px_rgba(185,255,75,0.08)] md:p-8">
            <h1 className="font-syne text-[40px] font-extrabold tracking-[-1.5px] text-foreground md:text-[48px]">
              Top Verified Startups
            </h1>
            <p className="mt-3 max-w-[680px] text-[16px] font-light text-muted-foreground">
              Discover the fastest-growing verified startups ranked by revenue,
              with transparent founder and city-level insights.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-border bg-muted p-5 shadow-sm">
                <p className="text-[12px] uppercase tracking-[1px] text-muted-foreground">
                  Total Startups
                </p>
                <p className="mt-2 font-syne text-[28px] font-bold text-foreground">
                  {loading ? "..." : rows.length}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted p-5 shadow-md">
                <p className="text-[12px] uppercase tracking-[1px] text-muted-foreground">
                  Total MRR
                </p>
                <p className="mt-2 font-syne text-[28px] font-bold text-primary">
                  {loading ? "..." : formatInr(totalMrr)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted p-5 shadow-sm">
                <p className="text-[12px] uppercase tracking-[1px] text-muted-foreground">
                  Countries
                </p>
                <p className="mt-2 font-syne text-[28px] font-bold text-foreground">
                  {loading ? "..." : totalCountries}
                </p>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
              <input
                type="text"
                placeholder="Search startup or founder..."
                className="h-11 min-w-[220px] flex-1 rounded-lg border border-border bg-[#161616] px-4 text-[14px] text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-border"
              />

              <select
                defaultValue="MRR"
                className="h-11 min-w-[150px] rounded-lg border border-border bg-[#161616] px-3 text-[14px] text-foreground outline-none transition-colors focus:border-border"
                aria-label="Sort"
              >
                <option>MRR</option>
                <option>ARR</option>
              </select>

              <select
                defaultValue="All categories"
                className="h-11 min-w-[180px] rounded-lg border border-border bg-[#161616] px-3 text-[14px] text-foreground outline-none transition-colors focus:border-border"
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
                className="h-11 min-w-[150px] rounded-lg border border-border bg-[#161616] px-3 text-[14px] text-foreground outline-none transition-colors focus:border-border"
                aria-label="Country"
              >
                <option>All countries</option>
                <option>India</option>
                <option>Global</option>
              </select>
            </div>
          </section>

          <section className="w-full overflow-x-auto">
            <div className="min-w-[980px] overflow-hidden rounded-xl border border-border">
              <div className="grid w-full grid-cols-6 items-center gap-4 border-b border-border bg-card px-4 py-3 text-[11px] font-medium uppercase tracking-[1px] text-muted-foreground">
                <div>#</div>
                <div>Startup</div>
                <div className="text-right">MRR</div>
                <div className="text-center">Growth</div>
                <div className="text-center">Country</div>
                <div className="text-right">Verified</div>
              </div>

              {loading ? (
                <div className="border-b border-border bg-[#0d0d0d] px-4 py-8 text-center text-sm text-muted-foreground">
                  Loading leaderboard...
                </div>
              ) : loadError ? (
                <div className="border-b border-border bg-[#0d0d0d] px-4 py-8 text-center text-sm text-[#ff4b4b]">
                  {loadError}
                </div>
              ) : rows.length === 0 ? (
                <div className="border-b border-border bg-[#0d0d0d] px-4 py-8 text-center text-sm text-muted-foreground">
                  No startups listed yet.
                </div>
              ) : (
                rows.map((row) => {
                const isTopThree = row.rank <= 3;
                const rankClassName =
                  row.rank === 1
                    ? "text-[#f5a623]"
                    : row.rank === 2
                      ? "text-muted-foreground"
                      : row.rank === 3
                        ? "text-[#cd7c3a]"
                        : "text-muted-foreground";

                return (
                  <div
                    key={row.id}
                    className={`grid w-full grid-cols-6 items-center gap-4 border-b border-border px-4 py-4 transition-colors duration-150 hover:bg-[#111111] ${
                      isTopThree ? "bg-muted" : "bg-[#0d0d0d]"
                    }`}
                  >
                    <div className={`font-syne text-[18px] font-bold ${rankClassName}`}>
                      {row.rank}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-medium text-foreground">
                        {row.startup_name}
                      </span>
                      <span className="truncate text-[13px] text-muted-foreground">
                        {row.founder}
                      </span>
                    </div>

                    <div className="text-right font-syne text-[16px] font-bold text-foreground">
                      {formatInr(row.mrr)}
                    </div>

                    <div
                      className={`text-center text-[14px] font-medium ${
                        row.growth_pct !== null && row.growth_pct >= 0
                          ? "text-primary"
                          : "text-[#ff4b4b]"
                      }`}
                    >
                      {row.growth_pct === null
                        ? "-"
                        : `${row.growth_pct >= 0 ? "+" : ""}${row.growth_pct.toFixed(1)}%`}
                    </div>

                    <div className="text-center text-[14px] text-muted-foreground">
                      {row.city}
                    </div>

                    <div className="flex flex-col items-end gap-1 justify-center">
                      <div className="flex justify-end">
                        {row.verification_status === "verified" ? (
                          <span className="text-green-400 text-[12px] uppercase font-bold tracking-wider">Verified</span>
                        ) : row.verification_status === "auto_verified" ? (
                          <span className="text-yellow-400 text-[12px] uppercase font-bold tracking-wider">Auto Verified</span>
                        ) : (
                          <span className="text-gray-400 text-[12px] uppercase font-bold tracking-wider">Pending</span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground">{row.confidence_score}%</span>
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
