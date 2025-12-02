"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";
import { ResponsiveContainer, Treemap, Tooltip as ReTooltip } from "recharts";

type Pkg = {
  packageId: string;
  packageName: string | null;
  clients: number;
  avgDaysLeft: number | null;
  active?: number;
  expired?: number;
};

type Node = {
  name: string;
  size: number;
  fill: string;
  label: string;
  clients: number;
  avgDaysLeft: number;
  active?: number;
  expired?: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** Color scale: 0 (low) -> 60+ (high)
 * Red → Yellow → Green
 */
function colorForDays(avgOrNull: number | null) {
  const v = clamp(avgOrNull ?? 0, 0, 60);
  const t = v / 60;
  const red = { r: 239, g: 68, b: 68 };
  const yel = { r: 245, g: 158, b: 11 };
  const grn = { r: 16, g: 185, b: 129 };
  const mid = 0.5;
  let r, g, b;
  if (t <= mid) {
    const u = t / mid;
    r = Math.round(red.r + (yel.r - red.r) * u);
    g = Math.round(red.g + (yel.g - red.g) * u);
    b = Math.round(red.b + (yel.b - red.b) * u);
  } else {
    const u = (t - mid) / (1 - mid);
    r = Math.round(yel.r + (grn.r - yel.r) * u);
    g = Math.round(yel.g + (grn.g - yel.g) * u);
    b = Math.round(yel.b + (grn.b - yel.b) * u);
  }
  return `rgb(${r}, ${g}, ${b})`;
}

export function PackageHealthTreemap({
  byPackage,
  height = 380,
}: {
  byPackage: Pkg[];
  height?: number;
}) {
  const nodes: Node[] = React.useMemo(
    () =>
      (byPackage ?? []).map((p) => ({
        name: p.packageName ?? p.packageId.slice(0, 6),
        size: Math.max(1, p.clients ?? 0),
        fill: colorForDays(p.avgDaysLeft ?? 0),
        label: p.packageName ?? p.packageId.slice(0, 6),
        clients: p.clients ?? 0,
        avgDaysLeft: p.avgDaysLeft ?? 0,
        active: p.active,
        expired: p.expired,
      })),
    [byPackage]
  );

  const totalClients = nodes.reduce((s, n) => s + (n.clients || 0), 0);

  return (
    <Card className="relative border-0 shadow-lg ring-1 ring-slate-200/60 p-6 rounded-3xl bg-gradient-to-br from-white via-slate-50 to-emerald-50 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 backdrop-blur-md overflow-hidden">
      {/* Header */}
      <div className="relative z-10 flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            📦 Package Health Overview
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Visual comparison of packages by client volume and health level
          </p>
        </div>
        <div className="text-xs text-slate-600 dark:text-slate-300">
          Total Clients:{" "}
          <span className="font-semibold text-slate-900 dark:text-white">
            {totalClients.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Treemap */}
      <div
        className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 shadow-inner"
        style={{ height }}
      >
        {nodes.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={nodes}
              dataKey="size"
              stroke="#fff"
              content={((props: any) => {
                const {
                  x,
                  y,
                  width,
                  height,
                  fill,
                  label,
                  clients,
                  avgDaysLeft,
                } = props;
                const W = width as number;
                const H = height as number;

                // Small cells: only color blocks
                if (W < 70 || H < 50) {
                  return (
                    <g>
                      <rect
                        x={x}
                        y={y}
                        width={W}
                        height={H}
                        fill={fill}
                        stroke="#fff"
                        rx={6}
                        style={{ opacity: 0.9 }}
                      />
                    </g>
                  );
                }

                return (
                  <g>
                    <rect
                      x={x}
                      y={y}
                      width={W}
                      height={H}
                      fill={fill}
                      stroke="#fff"
                      rx={10}
                      style={{
                        opacity: 0.95,
                        transition: "all 0.2s ease",
                      }}
                    />
                    <text
                      x={x + 10}
                      y={y + 22}
                      fill="#0f172a"
                      fontSize={13}
                      fontWeight={700}
                    >
                      {label}
                    </text>
                    <text
                      x={x + 10}
                      y={y + 40}
                      fill="#334155"
                      fontSize={11}
                    >{`Clients: ${clients}`}</text>
                    <text
                      x={x + 10}
                      y={y + 56}
                      fill="#334155"
                      fontSize={11}
                    >{`Days Left: ${avgDaysLeft}`}</text>
                  </g>
                );
              }) as any}
            >
              <ReTooltip
                contentStyle={{
                  borderRadius: 12,
                  borderColor: "#e2e8f0",
                  boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                  fontSize: 12,
                  background: "rgba(255,255,255,0.9)",
                }}
                formatter={(_, __, p: any) => {
                  const n: Node | undefined = p?.payload;
                  if (!n) return ["", ""];
                  return [
                    `Clients: ${n.clients} • Days Left: ${n.avgDaysLeft} ${
                      typeof n.active === "number" ||
                      typeof n.expired === "number"
                        ? `• Active: ${n.active ?? 0} • Expired: ${
                            n.expired ?? 0
                          }`
                        : ""
                    }`,
                    n.label,
                  ];
                }}
              />
            </Treemap>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
            No package data available
          </div>
        )}
      </div>

      {/* Legend + Explanation */}
      <div className="mt-5 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300 mb-1">
          <span>0 days</span>
          <span>~30 days</span>
          <span>60+ days</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gradient-to-r from-[#ef4444] via-[#f59e0b] to-[#10b981]" />
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 italic">
          🔍 Each box represents a package — bigger = more clients, color = time
          left before expiry (Red = short, Green = healthy).
        </p>
      </div>
    </Card>
  );
}
