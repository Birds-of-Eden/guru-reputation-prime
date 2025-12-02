"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { TrendingUp, Package, Calendar, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const ApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export function PackagesOverview({
  byPackage,
  timeseries,
  isLoading,
  summary,
  selectedPkg,
  setSelectedPkg,
}: {
  byPackage: any[];
  timeseries: any[];
  isLoading: boolean;
  summary?: any;
  selectedPkg?: string;
  setSelectedPkg?: (pkg: string) => void;
}) {
  const safePackages = Array.isArray(byPackage) ? byPackage : [];
  const safeSeries = Array.isArray(timeseries) ? timeseries : [];

  const totalPackages = safePackages.length;
  const totalClients = safePackages.reduce(
    (s, p) => s + (Number.isFinite(p?.clients) ? p.clients : 0),
    0
  );
  const top = safePackages?.[0];

  // --- Chart options (force clear intent + reliable render)
  const chartOptions: any = {
    chart: {
      type: "area",
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: { enabled: true, easing: "easeinout", speed: 600 },
      foreColor: "#64748b",
    },
    noData: {
      text: "No timeseries data available",
      align: "center",
      verticalAlign: "middle",
      style: { fontSize: "12px", color: "#94a3b8" },
    },
    colors: ["#06b6d4"],
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.5,
        opacityTo: 0.05,
        stops: [0, 100],
      },
    },
    stroke: {
      curve: "smooth",
      width: 3,
    },
    markers: {
      size: 0,
      hover: { size: 5 },
    },
    grid: {
      borderColor: "#e2e8f0",
      strokeDashArray: 4,
    },
    dataLabels: { enabled: false },
    tooltip: {
      theme: "light",
      x: { show: true },
      y: { formatter: (val: number) => `${val} starts` },
    },
    xaxis: {
      type: "category",
      categories: safeSeries.map((d) => d.day ?? ""),
      labels: { rotate: -45, style: { fontSize: "11px" } },
      title: { text: "Day" },
    },
    yaxis: {
      labels: { style: { fontSize: "11px" } },
      title: { text: "Package Starts" },
      min: 0,
      forceNiceScale: true,
    },
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "left",
    },
  };

  const chartSeries =
    safeSeries.length > 0
      ? [
          {
            name: "Daily Package Starts",
            data: safeSeries.map((d) => Number(d?.starts ?? 0)),
          },
        ]
      : [];

  // progress helper
  const pctActive = (p: any) => {
    const t = (p?.active ?? 0) + (p?.expired ?? 0);
    if (!t) return 0;
    return Math.round(((p?.active ?? 0) / t) * 100);
    // Health = % of active among (active+expired)
  };

  return (
    <section
      className="
        relative bg-gradient-to-br from-white via-slate-50 to-cyan-50
        rounded-3xl shadow-lg p-6 ring-1 ring-slate-200/70 overflow-hidden
        /* removed big fixed min-height to kill the bottom gap */
      "
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-100/50 via-transparent to-transparent opacity-60 pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Packages Overview
          </h2>
          <p className="text-sm text-slate-600">
            Visual insights into package performance, trends, and activity
          </p>
        </div>
        <div className="flex items-center gap-6 text-sm text-slate-700">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-500" />
            <span>{totalClients.toLocaleString()} Clients</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-sky-500" />
            <span>{totalPackages} Packages</span>
          </div>
        </div>
      </div>

      {/* Content Grid — chart on one side, rest on the other */}
      {isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : (
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* CHART SIDE */}
          <div className="lg:col-span-2">
            <Card className="border-0 shadow-md ring-1 ring-slate-200/60 bg-white/70 backdrop-blur-md">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-slate-900 font-semibold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-cyan-500" />
                  Package Start Trend
                </CardTitle>
                <span className="text-xs text-slate-500">
                  Last 90 days activity
                </span>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  {/* force re-render when data changes */}
                  <ApexChart
                    key={
                      safeSeries.length
                        ? `ts-${safeSeries.length}-${
                            safeSeries[safeSeries.length - 1]?.day
                          }-${safeSeries[safeSeries.length - 1]?.starts}`
                        : "ts-empty"
                    }
                    options={chartOptions}
                    series={chartSeries}
                    type="area"
                    height={280}
                  />
                </div>

                {/* Chart caption / purpose */}
                <p className="mt-3 text-xs text-slate-600 leading-relaxed">
                  Purpose: visualize daily package starts over the last 90 days
                  to quickly identify peaks, dips, and overall momentum.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT SIDE */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            {/* Top Performing Package */}
            {top && (
              <Card className="relative border-0 shadow-md ring-1 ring-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 backdrop-blur-md overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-slate-900 font-semibold flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                    Top Performing Package
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <h3 className="text-xl font-bold text-slate-900">
                    {top.packageName ?? "Unnamed Package"}
                  </h3>
                  <p className="text-sm text-slate-600">
                    {top.clients} Clients
                  </p>
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-sm text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
                      Active: {top.active ?? 0}
                    </span>
                    <span className="text-sm text-rose-700 bg-rose-100 px-3 py-1 rounded-full">
                      Expired: {top.expired ?? 0}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Premium Table */}
            <Card className="border-0 shadow-md ring-1 ring-slate-200/60 bg-white/70 backdrop-blur-md overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-900 font-semibold flex items-center gap-2">
                  <Package className="h-5 w-5 text-cyan-600" />
                  Top Packages Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gradient-to-r from-slate-100 to-slate-50 text-slate-700 uppercase text-xs tracking-wider sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left">#</th>
                        <th className="px-4 py-3 text-left">Package</th>
                        <th className="px-4 py-3 text-right">Clients</th>
                        <th className="px-4 py-3 text-right">Active</th>
                        <th className="px-4 py-3 text-right">Expired</th>
                        <th className="px-4 py-3 text-right">Health</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white/80">
                      {safePackages.slice(0, 6).map((p, idx) => (
                        <tr
                          key={p.packageId ?? idx}
                          className="hover:bg-cyan-50/70 transition-colors"
                        >
                          <td className="px-4 py-3 text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-800">
                            {p.packageName ?? "(Unnamed)"}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {p.clients ?? 0}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="inline-flex items-center justify-end gap-2">
                              <span className="text-emerald-700 font-semibold">
                                {p.active ?? 0}
                              </span>
                              <span className="h-2 w-20 rounded-full bg-slate-200 overflow-hidden">
                                <span
                                  className="h-2 block bg-emerald-400"
                                  style={{ width: `${pctActive(p)}%` }}
                                />
                              </span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-rose-600 font-semibold">
                            {p.expired ?? 0}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                pctActive(p) >= 70
                                  ? "bg-emerald-100 text-emerald-700"
                                  : pctActive(p) >= 40
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-rose-100 text-rose-700"
                              }`}
                            >
                              {pctActive(p)}% active
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-slate-50/70 text-xs text-slate-500 px-4 py-2 flex items-center justify-between">
                  <span>
                    Showing top {Math.min(6, safePackages.length)} of{" "}
                    {safePackages.length} packages
                  </span>
                  <span className="text-[11px] italic">
                    Tip: “Health” = Active / (Active + Expired)
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* KPI Overview */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-50 to-white border border-slate-200 shadow-sm">
                <h4 className="text-xs text-slate-600 uppercase mb-1">
                  Total Clients
                </h4>
                <p className="text-2xl font-bold text-cyan-700">
                  {totalClients.toLocaleString()}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-white border border-slate-200 shadow-sm">
                <h4 className="text-xs text-slate-600 uppercase mb-1">
                  Total Packages
                </h4>
                <p className="text-2xl font-bold text-emerald-700">
                  {totalPackages}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
