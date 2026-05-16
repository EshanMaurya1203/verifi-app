"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { TrendingUp } from "lucide-react";

interface RevenuePoint {
  timestamp: number;
  amount: number;
}

interface RevenueChartProps {
  data: RevenuePoint[];
}

/**
 * RevenueChart Component
 * 
 * Visualizes startup revenue trends over time using Recharts.
 * Optimized for displaying growth in the 30-90 day range.
 */
export const RevenueChart: React.FC<RevenueChartProps> = ({ data }) => {
  // Format timestamps for display on the X-axis
  const formattedData = [...data]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((d) => ({
      ...d,
      date: new Date(d.timestamp).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
    }));

  if (data.length === 0) {
    return (
      <div className="h-[300px] flex flex-col items-center justify-center bg-neutral-900/40 rounded-[2rem] border border-white/5">
        <div className="p-4 bg-white/5 rounded-full mb-4">
          <TrendingUp className="w-8 h-8 text-neutral-600" />
        </div>
        <p className="text-neutral-500 text-[10px] font-black uppercase tracking-widest text-center max-w-[200px] leading-relaxed">
          Insufficient snapshots for velocity projection
        </p>
      </div>
    );
  }

  return (
    <div className="h-[320px] w-full p-6 bg-transparent">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(255,255,255,0.03)" />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#525252", fontSize: 9, fontWeight: 800 }}
            dy={15}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#525252", fontSize: 9, fontWeight: 800 }}
            tickFormatter={(value) => `₹${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0a0a0a",
              borderRadius: "16px",
              border: "1px solid rgba(255,255,255,0.1)",
              padding: "12px",
              boxShadow: "0 20px 40px -10px rgba(0,0,0,0.5)",
            }}
            itemStyle={{ color: "#fff", fontSize: "11px", fontWeight: "900" }}
            labelStyle={{ color: "#525252", fontSize: "9px", fontWeight: "900", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}
            formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, "NET REVENUE"]}
            cursor={{ stroke: "rgba(99, 102, 241, 0.2)", strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="amount"
            stroke="#10b981"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 6, strokeWidth: 0, fill: "#10b981" }}
            animationDuration={2000}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
