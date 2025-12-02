"use client";

import { Card } from "@/components/ui/card";
import {
  Users,
  Clock,
  AlertTriangle,
  Activity,
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Skeleton } from "./Skeleton";
import CountUp from "react-countup";

export function SalesKPIGrid({
  summary,
  isLoading,
  trendData,
}: {
  summary: any;
  isLoading: boolean;
  trendData?: any;
}) {
  const KPIs = [
    {
      label: "Active Clients",
      value: summary?.active ?? 0,
      icon: <Users className="h-5 w-5 text-emerald-500" />,
      color: "#10b981",
      gradient: ["#a7f3d0", "#10b981"],
    },
    {
      label: "Expiring ≤30d",
      value: summary?.expiringSoon ?? 0,
      icon: <Clock className="h-5 w-5 text-amber-500" />,
      color: "#f59e0b",
      gradient: ["#fde68a", "#f59e0b"],
    },
    {
      label: "Expired",
      value: summary?.expired ?? 0,
      icon: <AlertTriangle className="h-5 w-5 text-rose-500" />,
      color: "#f43f5e",
      gradient: ["#fecdd3", "#f43f5e"],
    },
    {
      label: "Starting Soon",
      value: summary?.startingSoon ?? 0,
      icon: <Activity className="h-5 w-5 text-sky-500" />,
      color: "#0ea5e9",
      gradient: ["#bae6fd", "#0ea5e9"],
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mt-8">
      {KPIs.map((kpi, idx) => (
        <Card
          key={idx}
          className="relative overflow-hidden border-0 shadow-md ring-1 ring-slate-200/60 bg-white hover:shadow-xl hover:-translate-y-1 transition-all duration-300 rounded-2xl p-5"
        >
          {/* Gradient Background Blur */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              background: `linear-gradient(135deg, ${kpi.gradient[0]}, ${kpi.gradient[1]})`,
            }}
          />
          <div className="relative z-10">
            {isLoading ? (
              <Skeleton className="h-24" />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-slate-50 ring-1 ring-slate-100">
                      {kpi.icon}
                    </div>
                    <p className="text-sm font-semibold text-slate-700">
                      {kpi.label}
                    </p>
                  </div>
                  <TrendingUp className="h-4 w-4 text-slate-400" />
                </div>

                <div>
                  <h3 className="text-4xl font-extrabold text-slate-900 tracking-tight">
                    <CountUp end={kpi.value} duration={2.2} separator="," />
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Updated live from analytics
                  </p>
                </div>

                <div className="h-12">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={[{ value: kpi.value / 2 }, { value: kpi.value }]}
                    >
                      <defs>
                        <linearGradient
                          id={`grad-${idx}`}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor={kpi.color}
                            stopOpacity={0.6}
                          />
                          <stop
                            offset="95%"
                            stopColor={kpi.color}
                            stopOpacity={0.05}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        strokeOpacity={0.1}
                      />
                      <Tooltip
                        cursor={{ fill: "transparent" }}
                        formatter={(v) => [`${v}`, "Value"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={kpi.color}
                        strokeWidth={2.5}
                        fill={`url(#grad-${idx})`}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
