// components/clients/am-grouped-client-view.tsx

"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import type { Client } from "@/types/client";
import { ClientGrid } from "./client-grid";
import { ClientList } from "./client-list";
import ImpersonateButton from "@/components/users/ImpersonateButton";

import { ChevronDown, Package, Users, Heart } from "lucide-react";
import {
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
} from "recharts";

type AmGroup = {
  am: { id: string; name: string | null; email: string | null };
  clients: Client[];
};

interface AmGroupedClientViewProps {
  groupedClients: AmGroup[];
  onViewDetails: (client: Client) => void;
  viewMode: "grid" | "list";
  canImpersonateAm?: boolean;
  currentUserId?: string;
}

const STATUS_COLORS = {
  active: "#059669",
  expired: "#dc2626",
  other: "#94a3b8",
  sales: "#0e7490",
  total: "#334155",
};

// ✅ localStorage key for CEO favorites
const FAV_KEY = "ceo_favorites_v1";

export function AmGroupedClientView({
  groupedClients,
  onViewDetails,
  viewMode,
  canImpersonateAm = false,
  currentUserId,
}: AmGroupedClientViewProps) {
  // -------------------------
  // Favorites (am_ceo only)
  // -------------------------
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FAV_KEY);
      if (raw) {
        const arr: string[] = JSON.parse(raw);
        setFavoriteIds(new Set(arr));
      }
    } catch {
      // ignore
    }
  }, []);

  const persistFavorites = (next: Set<string>) => {
    try {
      window.localStorage.setItem(FAV_KEY, JSON.stringify(Array.from(next)));
    } catch {
      // ignore
    }
  };

  const toggleFavorite = (clientId: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      persistFavorites(next);
      return next;
    });
  };

  // Flatten all clients to derive the favorites list (unique by id)
  const allClients = useMemo<Client[]>(() => {
    const seen = new Set<string>();
    const out: Client[] = [];
    for (const g of groupedClients) {
      for (const c of g.clients) {
        if (!seen.has(c.id)) {
          seen.add(c.id);
          out.push(c);
        }
      }
    }
    return out;
  }, [groupedClients]);

  const favoriteClients = useMemo<Client[]>(
    () => allClients.filter((c) => favoriteIds.has(c.id)),
    [allClients, favoriteIds]
  );

  // --- Favourites hover-only expand ---
  const favTimer = useRef<number | undefined>(undefined);
  const [favHovered, setFavHovered] = useState(false);

  const clearFavTimer = () => {
    if (favTimer.current) {
      window.clearTimeout(favTimer.current);
      favTimer.current = undefined;
    }
  };

  const handleFavEnter = () => {
    clearFavTimer();
    favTimer.current = window.setTimeout(() => {
      setFavHovered(true);
      favTimer.current = undefined;
    }, 80); // small delay to avoid jitter
  };

  const handleFavLeave = () => {
    clearFavTimer();
    favTimer.current = window.setTimeout(() => {
      setFavHovered(false);
      favTimer.current = undefined;
    }, 120);
  };

  // -------------------------
  // Expand/hover behavior for AM sections
  // -------------------------
  const [expandedManual, setExpandedManual] = useState<Record<string, boolean>>(
    {}
  );

  const defaultExpanded = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const g of groupedClients) map[g.am.id] = false;
    return map;
  }, [groupedClients]);

  const getIsExpanded = useCallback(
    (amId: string): boolean => {
      if (typeof expandedManual[amId] === "boolean") {
        return expandedManual[amId];
      }
      return defaultExpanded[amId] ?? false;
    },
    [expandedManual, defaultExpanded]
  );

  const toggleOpen = (id: string) => {
    setExpandedManual((s) => {
      const next = !getIsExpanded(id);
      return { ...s, [id]: next };
    });
  };

  const getAmLabel = (am: AmGroup["am"]): string => {
    if (am.id === "unassigned")
      return "Unassigned Clients (No Account Manager)";
    const name = am.name || `AM ID: ${am.id}`;
    const email = am.email ? ` (${am.email})` : "";
    return name + email;
  };

  const avatarText = (am: AmGroup["am"]) => {
    if (am.id === "unassigned") return "NA";
    const base = am.name || am.email || am.id;
    const parts = String(base).trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return String(base)[0]?.toUpperCase() ?? "A";
  };

  const hasPackage = (c: Client) =>
    Boolean((c as any)?.packageId ?? (c as any)?.package?.id);

  return (
    <div className="space-y-8">
      {/* ----------------------------- */}
      {/* Favorites section (hover-collapsible, always on top) */}
      {/* ----------------------------- */}
      {favoriteClients.length > 0 && (
        <section
          className={`overflow-hidden rounded-xl border border-amber-200 bg-amber-50 shadow-sm transition-all duration-300 ${
            favHovered ? "shadow-md" : "shadow-sm"
          }`}
          onMouseEnter={handleFavEnter}
          onMouseLeave={handleFavLeave}
          aria-expanded={favHovered}
        >
          {/* Header stays visible; body reveals on hover */}
          <header className="flex items-center justify-between p-4 md:p-6 bg-amber-50">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-amber-100 text-amber-700 ring-2 ring-amber-300">
                <Heart className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-amber-800">Favorites</h2>
                <p className="text-sm text-amber-700">
                  Quick access to clients you starred
                </p>
              </div>
            </div>

            {/* subtle hint that it expands */}
            <span
              className={`text-xs font-medium px-2 py-1 rounded-full border transition ${
                favHovered
                  ? "bg-white/70 border-amber-300 text-amber-700"
                  : "bg-white/40 border-amber-200 text-amber-600"
              }`}
            >
              Hover to expand
            </span>
          </header>

          {/* Collapsible body: hidden until hovered */}
          <div
            className={`transition-all duration-300 ease-out ${
              favHovered
                ? "opacity-100 max-h-[1200px] p-4 md:p-6"
                : "opacity-0 max-h-0 p-0"
            }`}
            style={{ overflow: "hidden" }}
          >
            <ClientGrid
              clients={favoriteClients}
              onViewDetails={onViewDetails}
              // wire favorites down so cards can render filled hearts
              favoriteIds={favoriteIds}
              onToggleFavorite={toggleFavorite}
            />
          </div>
        </section>
      )}

      {/* ----------------------------- */}
      {/* Regular AM sections (existing UI/logic) */}
      {/* ----------------------------- */}
      {groupedClients.map((group) => {
        const amId = group.am.id;
        const canImpersonateThisAm =
          canImpersonateAm &&
          typeof amId === "string" &&
          amId.length > 0 &&
          amId !== "unassigned" &&
          (!currentUserId || currentUserId !== amId);
        const impersonateLabel =
          group.am.name || group.am.email || "Account Manager";
        const isOpen = getIsExpanded(amId);

        // metrics
        const salesCount = group.clients.reduce(
          (acc, c) => acc + (hasPackage(c) ? 1 : 0),
          0
        );
        let activeCount = 0;
        let expiredCount = 0;
        for (const client of group.clients) {
          const status = ((client as any)?.status ?? "")
            .toString()
            .toLowerCase();
          if (status === "active") activeCount++;
          else if (status === "expired") expiredCount++;
        }
        const totalCount = group.clients.length;

        const summaryData = [
          { name: "Sales", value: salesCount, color: STATUS_COLORS.sales },
          { name: "Active", value: activeCount, color: STATUS_COLORS.active },
          { name: "Total", value: totalCount, color: STATUS_COLORS.total },
        ];

        const CustomTooltip = ({ active, payload, label }: any) => {
          if (active && payload && payload.length) {
            const p = payload[0];
            return (
              <div className="rounded-md bg-white p-2 text-sm shadow-lg ring-1 ring-black ring-opacity-5">
                <p className="font-semibold" style={{ color: p.payload.color }}>
                  {label}
                </p>
                <p className="text-gray-700">{p.value}</p>
              </div>
            );
          }
          return null;
        };

        return (
          <section
            key={amId}
            className={`overflow-hidden rounded-xl border transition duration-300 ${
              isOpen
                ? "border-cyan-300 bg-white shadow-xl"
                : "border-gray-200 bg-white shadow-sm hover:shadow-md"
            }`}
          >
            {/* Header */}
            <header
              aria-expanded={isOpen}
              className={`flex items-stretch justify-between transition duration-300 p-4 md:p-6 ${
                isOpen ? "bg-white" : "bg-gray-50 hover:bg-white"
              }`}
            >
              <div
                className="flex items-center gap-4 cursor-pointer"
                onClick={() => toggleOpen(amId)}
              >
                <div className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-full bg-gradient-to-br from-cyan-100 to-teal-100 text-cyan-700 ring-2 ring-cyan-300">
                  <span className="text-lg font-bold">
                    {avatarText(group.am)}
                  </span>
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-bold text-gray-900 leading-snug">
                    {getAmLabel(group.am)}
                  </h2>
                  <p className="mt-0.5 text-sm text-gray-600">
                    Account Manager • ID:{" "}
                    <span className="font-mono font-medium text-cyan-700">
                      {amId}
                    </span>
                  </p>
                </div>
              </div>

              {/* Status + chart */}
              <div className="flex items-center gap-6">
                {totalCount > 0 && (
                  <div className="hidden lg:block w-44 h-24 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={summaryData}
                        margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
                      >
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis hide allowDecimals={false} width={0} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {summaryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 md:gap-4 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-sm font-medium text-slate-800">
                      <Users className="w-4 h-4 mr-1 text-slate-500" />
                      {totalCount} Clients
                    </span>
                    <span className="flex items-center rounded-full border border-cyan-300 bg-cyan-100 px-3 py-1 text-sm font-medium text-cyan-800">
                      <Package className="w-4 h-4 mr-1 text-cyan-500" />
                      {salesCount} Sales
                    </span>
                  </div>

                  {(activeCount > 0 || expiredCount > 0) && (
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                      <span className="rounded-full bg-emerald-100 text-emerald-800 px-3 py-1">
                        Active: {activeCount}
                      </span>
                      <span className="rounded-full bg-rose-100 text-rose-800 px-3 py-1">
                        Expired: {expiredCount}
                      </span>
                    </div>
                  )}
                </div>

                {canImpersonateThisAm && (
                  <ImpersonateButton
                    targetUserId={amId}
                    targetName={impersonateLabel}
                    className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                  />
                )}

                <button
                  type="button"
                  onClick={() => toggleOpen(amId)}
                  className="p-2 rounded-full text-gray-500 hover:text-gray-700 transition duration-150"
                  aria-label={isOpen ? "Collapse" : "Expand"}
                  title="Click to lock/unlock"
                >
                  <ChevronDown
                    className={`w-6 h-6 transform transition-transform ${
                      isOpen ? "rotate-180 text-cyan-600" : "rotate-0"
                    }`}
                  />
                </button>
              </div>
            </header>

            <div
              className={`h-px w-full bg-gradient-to-r from-transparent via-gray-200 to-transparent ${
                isOpen ? "opacity-100" : "opacity-0"
              } transition duration-300`}
            />

            {isOpen && (
              <div className="p-4 md:p-6 transition-all duration-300 ease-out">
                {totalCount === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-500">
                    <Package className="w-6 h-6 mx-auto mb-2" />
                    <p className="font-medium">
                      No clients assigned to this manager yet (based on current
                      filters).
                    </p>
                  </div>
                ) : viewMode === "grid" ? (
                  <ClientGrid
                    clients={group.clients}
                    onViewDetails={onViewDetails}
                    favoriteIds={favoriteIds}
                    onToggleFavorite={toggleFavorite}
                  />
                ) : (
                  <ClientList
                    clients={group.clients}
                    onViewDetails={onViewDetails}
                  />
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
