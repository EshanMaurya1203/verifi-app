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
} from "recharts";

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
      <div className="h-[300px] flex flex-col items-center justify-center bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-100">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
        </div>
        <p className="text-gray-400 text-sm font-medium">Insufficient data for revenue history</p>
      </div>
    );
  }

  return (
    <div className="h-[320px] w-full p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
      <div className="flex items-center justify-between mb-6 px-2">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Revenue Growth</h3>
        <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            Verified MRR
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={formattedData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f9fafb" />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#d1d5db", fontSize: 10, fontWeight: 600 }}
            dy={15}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#d1d5db", fontSize: 10, fontWeight: 600 }}
            tickFormatter={(value) => `₹${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#111827",
              borderRadius: "12px",
              border: "none",
              padding: "12px",
              boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
            }}
            itemStyle={{ color: "#fff", fontSize: "12px", fontWeight: "bold" }}
            labelStyle={{ color: "#9ca3af", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}
            formatter={(value: number) => [`₹${value.toLocaleString()}`, "Amount"]}
            cursor={{ stroke: "#f3f4f6", strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="amount"
            stroke="#10b981"
            strokeWidth={4}
            dot={{ fill: "#10b981", strokeWidth: 2, r: 4, stroke: "#fff" }}
            activeDot={{ r: 6, strokeWidth: 0 }}
            animationDuration={1500}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
