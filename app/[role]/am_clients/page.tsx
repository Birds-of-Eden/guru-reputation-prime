// app/[role]/am_clients/page.tsx

"use client";

import { useState, useCallback, useEffect, useMemo, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ClientOverviewHeader } from "@/components/clients/client-overview-header";
import { ClientStatusSummary } from "@/components/clients/client-status-summary";
import { ClientCardSkeleton } from "@/components/clients/client-card-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Client } from "@/types/client";
import { useUserSession } from "@/lib/hooks/use-user-session";
import { useClients } from "@/lib/hooks/use-clients";
// Lazy load heavy components
const ClientGrid = lazy(() => import("@/components/clients/client-grid").then(m => ({ default: m.ClientGrid })));
const ClientList = lazy(() => import("@/components/clients/client-list").then(m => ({ default: m.ClientList })));

export default function ClientsPage() {
  const router = useRouter();

  // ✅ হুক থেকে user / loading সঠিকভাবে নাও
  const { user, loading: sessionLoading } = useUserSession();

  // Use enhanced hook with SWR + pre-indexed filtering
  const { clients, loading, index, getFilteredClients } = useClients();
  
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [packageFilter, setPackageFilter] = useState("all");
  const [amFilter, setAmFilter] = useState("all");

  // Debounce search input to reduce filtering operations
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const [packages, setPackages] = useState<{ id: string; name: string }[]>([]);

  const currentUserId = user?.id ?? undefined;
  const currentUserRole = user?.role ?? undefined; // hook এ role string আসে
  const isAM = (currentUserRole ?? "").toLowerCase() === "am";

  useEffect(() => {
    if (
      !sessionLoading &&
      isAM &&
      currentUserId &&
      amFilter !== currentUserId
    ) {
      setAmFilter(currentUserId);
    }
  }, [sessionLoading, isAM, currentUserId]);


  // --- Packages ফেচ - Memoized ---
  const fetchPackages = useCallback(async () => {
    try {
      const resp = await fetch("/api/packages");
      if (!resp.ok) throw new Error("Failed to fetch packages");

      const raw = await resp.json();
      const list =
        (Array.isArray(raw) && raw) ||
        (Array.isArray(raw?.data) && raw.data) ||
        [];

      const mapped: { id: string; name: string }[] = (list as any[]).map(
        (p) => ({
          id: String(p.id),
          name: String(p.name ?? "Unnamed"),
        })
      );
      setPackages(mapped);
    } catch {
      // fallback: বর্তমান clients থেকে derive করো
      const derived = Array.from(
        clients.reduce((map, c) => {
          if (c.packageId)
            map.set(String(c.packageId), {
              id: String(c.packageId),
              name: c.package?.name ?? String(c.packageId),
            });
          return map;
        }, new Map<string, { id: string; name: string }>())
      ).map(([, v]) => v);
      setPackages(derived);
    }
  }, [clients]);

  // Fetch packages only when clients are loaded
  useEffect(() => {
    if (!sessionLoading && clients.length > 0) {
      fetchPackages();
    }
  }, [sessionLoading, clients.length, fetchPackages]);

  // Navigate to details
  const handleViewClientDetails = (client: Client) => {
    router.push(`/am/clients/${client.id}`);
  };

  const handleAddNewClient = useCallback(() => {
    router.push("/am/clients/onboarding");
  }, [router]);

  // Account manager options build (AM হলে নিজেরটাই থাকবে)
  const accountManagers = useMemo(
    () =>
      Array.from(
        clients.reduce((map, c) => {
          const id = c.amId ?? c.accountManager?.id;
          if (!id) return map;
          const nm = c.accountManager?.name ?? null;
          const email = c.accountManager?.email ?? null;
          const label = nm ? (email ? `${nm} (${email})` : nm) : String(id);
          if (!map.has(String(id)))
            map.set(String(id), { id: String(id), label });
          return map;
        }, new Map<string, { id: string; label: string }>())
      ).map(([, v]) => v),
    [clients]
  );

  // ✅ Use pre-indexed optimized filtering - O(1) lookups
  const filteredClients = useMemo(() => {
    const effectiveAmFilter = isAM && currentUserId ? String(currentUserId) : amFilter;
    
    return getFilteredClients({
      status: statusFilter,
      packageId: packageFilter,
      amId: effectiveAmFilter,
      searchQuery: debouncedSearch,
    });
  }, [getFilteredClients, statusFilter, packageFilter, isAM, currentUserId, amFilter, debouncedSearch]);

  // Professional Loading UI with skeleton
  if (sessionLoading || loading) {
    return (
      <div className="py-8 px-4 md:px-6 space-y-8">
        {/* Header Card Skeleton */}
        <Card className="shadow-lg border border-gray-100">
          <CardHeader className="space-y-4">
            {/* Title and Add Button */}
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-96" />
              </div>
              <Skeleton className="h-10 w-32 rounded-md" />
            </div>
            
            {/* Search and Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Skeleton className="h-10 w-full col-span-2" /> {/* Search */}
              <Skeleton className="h-10 w-full" /> {/* Status filter */}
              <Skeleton className="h-10 w-full" /> {/* Package filter */}
            </div>
            
            {/* View Mode Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Skeleton className="h-8 w-8 rounded" />
                <Skeleton className="h-8 w-8 rounded" />
              </div>
              <Skeleton className="h-6 w-32" />
            </div>
          </CardHeader>
          
          <CardContent>
            {/* Status Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`stat-${index}`} className="p-4 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-5 w-5 rounded" />
                  </div>
                  <Skeleton className="h-8 w-12" />
                  <Skeleton className="h-3 w-16 mt-1" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        {/* Client Cards Grid Skeleton */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={`client-skeleton-${index}`} className="overflow-hidden">
              <CardContent className="p-6">
                {/* Client Header */}
                <div className="flex items-start gap-4 mb-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
                
                {/* Progress Section */}
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-5 w-18 rounded-full" />
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Skeleton className="h-9 flex-1 rounded" />
                  <Skeleton className="h-9 w-20 rounded" />
                </div>
              </CardContent>
            </Card>
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
          packages={packages} // [{ id, name }]
          amFilter={amFilter}
          setAmFilter={setAmFilter}
          accountManagers={accountManagers} // [{ id, label }]
          currentUserId={currentUserId}
          currentUserRole={currentUserRole} // e.g. "am"
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
