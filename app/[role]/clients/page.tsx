// app/[role]/clients/page.tsx

"use client";
import { useState, useCallback, useEffect, useMemo, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ClientOverviewHeader } from "@/components/clients/client-overview-header";
import { ClientStatusSummary } from "@/components/clients/client-status-summary";
// Lazy load heavy components for better initial load
const ClientGrid = lazy(() => import("@/components/clients/client-grid").then(m => ({ default: m.ClientGrid })));
const ClientList = lazy(() => import("@/components/clients/client-list").then(m => ({ default: m.ClientList })));
import { ClientCardSkeleton } from "@/components/clients/client-card-skeleton";
import type { Client } from "@/types/client";
import { useRoleSegment } from "@/lib/hooks/use-role-segment";
import { useClients } from "@/lib/hooks/use-clients";

export default function ClientsPage() {
  const router = useRouter();
  const roleSegment = useRoleSegment();

  // Use enhanced hook with SWR + pre-indexed filtering
  const { clients, loading, index, getFilteredClients } = useClients();
  
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [packageFilter, setPackageFilter] = useState("all");
  const [amFilter, setAmFilter] = useState("all");
  const [packages, setPackages] = useState<{ id: string; name: string }[]>([]);

  // Debounce search input to reduce filtering operations
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch packages for names - memoized to prevent re-fetch
  const fetchPackages = useCallback(async () => {
    try {
      const resp = await fetch("/api/packages");
      if (!resp.ok) throw new Error("Failed to fetch packages");
      const raw = await resp.json();
      const list = Array.isArray(raw) ? raw : raw?.data ?? [];
      const mapped: { id: string; name: string }[] = (list as any[]).map(
        (p) => ({
          id: String(p.id),
          name: String(p.name ?? "Unnamed"),
        })
      );
      setPackages(mapped);
    } catch (e) {
      // fallback: derive from clients if API fails
      const derived = Array.from(
        clients.reduce((map, c) => {
          if (c.packageId)
            map.set(c.packageId, {
              id: c.packageId,
              name: c.package?.name ?? c.packageId,
            });
          return map;
        }, new Map<string, { id: string; name: string }>())
      ).map(([, v]) => v);
      setPackages(derived);
    }
  }, [clients]);

  // Fetch packages only when clients are loaded
  useEffect(() => {
    if (clients.length > 0) {
      fetchPackages();
    }
  }, [clients.length, fetchPackages]);

  const handleViewClientDetails = useCallback(
    (client: Client) => {
      const detailPath = `/${roleSegment}/clients/${client.id}`;
      try {
        (router as any)?.prefetch?.(detailPath);
      } catch {
        /* ignore prefetch errors */
      }
      router.push(detailPath);
    },
    [router, roleSegment]
  );

  const handleAddNewClient = useCallback(() => {
    router.push(`/${roleSegment}/clients/onboarding`);
  }, [router, roleSegment]);

  // ✅ Use pre-indexed optimized filtering - O(1) lookups instead of O(n)
  const filteredClients = useMemo(() => {
    return getFilteredClients({
      status: statusFilter,
      packageId: packageFilter,
      amId: amFilter,
      searchQuery: debouncedSearch,
    });
  }, [getFilteredClients, statusFilter, packageFilter, amFilter, debouncedSearch]);

  // packages come from API/state to ensure names are accurate

  // Memoize account managers list to prevent re-computation
  const accountManagers = useMemo(() => {
    return Array.from(
      clients.reduce((map, c) => {
        const id = c.amId ?? c.accountManager?.id;
        if (!id) return map;
        const nm = c.accountManager?.name ?? null;
        const label = nm || id;
        if (!map.has(id)) map.set(id, { id, label });
        return map;
      }, new Map<string, { id: string; label: string }>())
    ).map(([, v]) => v);
  }, [clients]);

  if (loading) {
    return (
      <div className="py-8 px-4 md:px-6">
        {/* Header skeleton */}
        <div className="bg-white p-6 rounded-xl shadow-lg mb-8 border border-gray-100">
          <div className="h-12 bg-gray-200 rounded animate-pulse mb-4"></div>
          <div className="flex gap-4 mb-4">
            <div className="h-10 w-32 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-10 w-32 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-10 w-32 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>

        {/* Grid skeleton */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <ClientCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 px-4 md:px-6">
      {/* Header + Summary */}
      <div className="bg-white p-6 rounded-xl shadow-lg mb-8 border border-gray-100">
        <ClientOverviewHeader
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          packageFilter={packageFilter}
          setPackageFilter={setPackageFilter}
          packages={packages}
          amFilter={amFilter}
          setAmFilter={setAmFilter}
          accountManagers={accountManagers}
          viewMode={viewMode}
          setViewMode={setViewMode}
          onAddNewClient={handleAddNewClient}
        />
        <ClientStatusSummary clients={clients} />
      </div>

      {/* Clients Grid or List with Suspense for lazy loading */}
      {filteredClients.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white rounded-xl shadow-lg border border-gray-100">
          <p className="text-lg font-medium mb-2">
            No clients found matching your criteria.
          </p>
          <p className="text-sm">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <ClientCardSkeleton key={i} />
              ))}
            </div>
          }
        >
          {viewMode === "grid" ? (
            <ClientGrid
              clients={filteredClients}
              onViewDetails={handleViewClientDetails}
            />
          ) : (
            <ClientList
              clients={filteredClients}
              onViewDetails={handleViewClientDetails}
            />
          )}
        </Suspense>
      )}
    </div>
  );
}
