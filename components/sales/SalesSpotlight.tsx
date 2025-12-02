"use client";

import CountUp from "react-countup";
import {
  TrendingUp,
  Star,
  Sparkles,
  PieChart as PieIcon,
  LineChart as LineIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { Skeleton } from "./Skeleton";

const COLORS = [
  "#06b6d4",
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#f43f5e",
];

export function SalesSpotlight({
  isLoading,
  totalSales,
  growth,
  series,
  packageSales,
}: {
  isLoading: boolean;
  totalSales: number;
  growth: { delta: number; pct: number } | null;
  series: { day: string; starts: number }[];
  packageSales: {
    packageId: string;
    packageName: string | null;
    sales: number;
    sharePercent: number;
  }[];
}) {
  const topPackage = packageSales?.[0];

  return (
    <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-slate-200/60 bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-2xl p-6 transition-all duration-300 hover:shadow-2xl">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left Summary */}
        <div className="p-8 flex flex-col justify-between rounded-xl bg-gradient-to-br from-cyan-50 to-white ring-1 ring-cyan-100 shadow-sm hover:shadow-md transition-all">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-xl bg-white shadow-sm ring-1 ring-cyan-200/50">
                <Sparkles className="h-5 w-5 text-cyan-600" />
              </div>
              <p className="text-sm font-semibold text-cyan-700 tracking-wide">
                Sales Performance Overview
              </p>
            </div>

            <h2 className="text-5xl font-extrabold text-slate-900 tracking-tight mb-2">
              {isLoading ? (
                <Skeleton className="h-10 w-48" />
              ) : (
                <CountUp end={totalSales} duration={2} separator="," />
              )}
            </h2>
            <p className="text-sm text-slate-600 mb-5">
              Total Clients with Active Packages
            </p>

            {growth && (
              <div
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm shadow-sm ring-1 ${
                  growth.delta >= 0
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    : "bg-rose-50 text-rose-700 ring-rose-200"
                }`}
              >
                <TrendingUp className="h-4 w-4" />
                {growth.delta >= 0 ? "+" : ""}
                {growth.delta} vs prev. 30d
                <span className="opacity-70 ml-1">
                  ({growth.pct >= 0 ? "+" : ""}
                  {growth.pct.toFixed(1)}%)
                </span>
              </div>
            )}
          </div>

          {topPackage && (
            <div className="mt-8 p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-indigo-100 border border-indigo-200 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Star className="text-indigo-600 h-4 w-4" />
                <p className="text-sm font-semibold text-indigo-700">
                  Top Performing Package
                </p>
              </div>
              <p className="text-sm text-slate-800">
                <span className="font-bold">
                  {topPackage.packageName ?? "Unnamed Package"}
                </span>{" "}
                — {topPackage.sales} clients (
                {topPackage.sharePercent.toFixed(1)}%)
              </p>
            </div>
          )}
        </div>

        {/* Area Chart */}
        <div className="p-8 rounded-xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <LineIcon className="h-4 w-4 text-sky-600" />
              <p className="text-sm font-semibold text-slate-700">
                30-Day Sales Trend
              </p>
            </div>
            <div className="h-56">
              {isLoading ? (
                <Skeleton className="h-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series.slice(-30)}>
                    <defs>
                      <linearGradient
                        id="salesGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#06b6d4"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor="#06b6d4"
                          stopOpacity={0.1}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      tickMargin={6}
                    />
                    <Tooltip
                      formatter={(value) => [`${value} starts`, "Sales"]}
                      contentStyle={{
                        background: "rgba(255,255,255,0.9)",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="starts"
                      stroke="#06b6d4"
                      strokeWidth={3}
                      fill="url(#salesGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <p className="text-xs text-center text-slate-500 mt-3">
            Shows daily sales performance for the last 30 days
          </p>
        </div>

        {/* Donut PieChart */}
        <div className="p-8 rounded-xl bg-gradient-to-br from-slate-50 to-gray-50 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <PieIcon className="h-4 w-4 text-violet-600" />
              <p className="text-sm font-semibold text-slate-700">
                Package Share Distribution
              </p>
            </div>
            <div className="h-56 flex items-center justify-center">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={packageSales.map((p) => ({
                        name: p.packageName ?? p.packageId.slice(0, 6),
                        value: p.sharePercent,
                      }))}
                      innerRadius={70}
                      outerRadius={100}
                      cornerRadius={5}
                      startAngle={90}
                      endAngle={450}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {packageSales.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend
                      verticalAlign="bottom"
                      height={30}
                      iconSize={10}
                      formatter={(v) => (
                        <span className="text-xs text-slate-600">{v}</span>
                      )}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        `${Number(value).toFixed(1)}%`,
                        name,
                      ]}
                      contentStyle={{
                        background: "rgba(255,255,255,0.9)",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <p className="text-xs text-center text-slate-500 mt-3">
            Percentage share of each active package
          </p>
        </div>
      </div>
    </Card>
  );
}
