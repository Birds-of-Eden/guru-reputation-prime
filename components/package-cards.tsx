// components/package-cards.tsx

"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { AddPackageModal } from "@/components/add-package-modal";
import { PackageDetailsModal } from "@/components/package-details-modal";
import {
  Eye,
  Info,
  Plus,
  Package as PackageIcon,
  Users,
  FileText,
  Activity,
  TrendingUp,
  Star,
  Edit3,
  Calendar,
  Target,
  BarChart3,
  Globe,
  Trash2, // ⬅️ NEW
} from "lucide-react";

import { useUserSession } from "@/lib/hooks/use-user-session";
import { hasPermissionClient } from "@/lib/permissions-client";
import { cn } from "@/lib/utils";

interface PackageStats {
  clients: number;
  templates: number;
  activeTemplates: number;
  sitesAssets: number;
  teamMembers: number;
  assignments: number;
  tasks: number;
}

interface Package {
  id: string;
  name: string | null;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
  totalMonths?: number;
  stats?: PackageStats;
}

export function PackageCards() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { user, loading } = useUserSession();

  // ⚡ OPTIMIZED: Use SWR for automatic caching and revalidation
  const jsonFetcher = async (url: string) => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
  };

  const { data: packageList = [], isLoading, mutate: mutatePackages } = useSWR<Package[]>(
    "/api/zisanpackages?include=stats",
    jsonFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      refreshInterval: 60000,
    }
  );

  const addPackage = async (newPackage: Omit<Package, "id" | "stats">) => {
    try {
      const response = await fetch("/api/zisanpackages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-actor-id": user?.id || "",
        },
        body: JSON.stringify({
          ...newPackage,
          actorId: user?.id || null,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to create package");
      }

      await response.json();
      setIsModalOpen(false);
      // ⚡ OPTIMIZED: Use SWR mutate for instant refresh
      await mutatePackages();
    } catch (error: any) {
      console.error("Error adding package:", error);
      alert(error.message || "Error adding package");
    }
  };

  const updatePackage = async (
    id: string,
    updatedData: { name: string; description?: string; type?: string }
  ) => {
    try {
      const response = await fetch(`/api/zisanpackages/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-actor-id": user?.id || "",
        },
        body: JSON.stringify({
          ...updatedData,
          actorId: user?.id || null,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to update package");
      }

      await response.json();
      setEditingPackage(null);
      // ⚡ OPTIMIZED: Use SWR mutate for instant refresh
      await mutatePackages();
    } catch (error: any) {
      console.error("Error updating package:", error);
      alert(error.message || "Error updating package");
    }
  };

  const handleSeeTemplates = (pkg: Package) => {
    const role = user?.role?.toLowerCase();
    const basePath =
      role === "admin"
        ? "admin"
        : role === "manager"
        ? "manager"
        : "data_entry";
    router.push(`/${basePath}/packages/${pkg.id}/templates`);
  };

  const handleViewDetails = (packageId: string) => {
    setSelectedPackage(packageId);
    setIsDetailsModalOpen(true);
  };

  const deletePackage = async (id: string) => {
    const confirmDelete = confirm(
      "Are you sure you want to delete this package? This action cannot be undone."
    );
    if (!confirmDelete) return;

    setDeletingId(id);
    try {
      const response = await fetch(`/api/zisanpackages/${id}`, {
        method: "DELETE",
        headers: {
          "x-actor-id": user?.id || "",
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          error?.error || "Failed to delete package. It may have relations."
        );
      }

      // ⚡ OPTIMIZED: Use SWR mutate for instant refresh
      await mutatePackages();
    } catch (error: any) {
      console.error("Error deleting package:", error);
      alert(error.message || "Something went wrong while deleting.");
    } finally {
      setDeletingId(null);
    }
  };

  const getPackageHealthScore = (pkg: Package) => {
    const s = pkg.stats;
    if (!s) return 0;
    let score = 0;
    if (s.templates > 0) score += 20;
    if (s.activeTemplates > 0) score += 20;
    if (s.clients > 0) score += 20;
    if (s.assignments > 0) score += 20;
    if (s.tasks > 0) score += 20;
    return Math.min(score, 100);
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return "text-emerald-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getHealthBg = (score: number) => {
    if (score >= 80) return "from-emerald-50 to-emerald-100 border-emerald-200";
    if (score >= 60) return "from-yellow-50 to-yellow-100 border-yellow-200";
    return "from-red-50 to-red-100 border-red-200";
  };

  const canCreate =
    !loading && hasPermissionClient(user?.permissions, "package_create");
  const canDelete =
    !loading && hasPermissionClient(user?.permissions, "package_delete");
  const canEdit =
    !loading && hasPermissionClient(user?.permissions, "package_edit");

  // ⚡ OPTIMIZED: Memoize statistics to prevent recalculation
  const totalStats = useMemo(() => {
    return {
      templates: packageList.reduce((t, p) => t + (p.stats?.templates ?? 0), 0),
      clients: packageList.reduce((t, p) => t + (p.stats?.clients ?? 0), 0),
      activeTemplates: packageList.reduce((t, p) => t + (p.stats?.activeTemplates ?? 0), 0),
    };
  }, [packageList]);

  // Show loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-10 w-96 bg-gray-200 animate-pulse rounded" />
            <div className="h-6 w-64 bg-gray-200 animate-pulse rounded" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="border-0 shadow-lg">
              <CardContent className="p-4 text-center">
                <div className="h-16 w-16 bg-gray-200 animate-pulse rounded-full mx-auto mb-4" />
                <div className="h-10 w-20 bg-gray-200 animate-pulse rounded mx-auto mb-2" />
                <div className="h-4 w-32 bg-gray-200 animate-pulse rounded mx-auto" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="pb-4">
                <div className="h-6 w-3/4 bg-gray-200 animate-pulse rounded" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-4 w-full bg-gray-200 animate-pulse rounded" />
                <div className="h-20 bg-gray-200 animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
            Package Management
          </h1>
          <p className="text-gray-600 text-lg">
            Manage your packages and track their performance
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={() => setIsModalOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 rounded-xl px-8"
          >
            <Plus className="mr-2 h-5 w-5" />
            Add Package
          </Button>
        )}
      </div>

      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
          <CardContent className="p-4 text-center">
            <div className="p-3 bg-blue-200 rounded-full w-fit mx-auto mb-4">
              <PackageIcon className="w-8 h-8 text-blue-700" />
            </div>
            <div className="text-3xl font-bold text-blue-900 mb-2">
              {packageList?.length ?? 0}
            </div>
            <div className="text-sm text-blue-700 font-medium">
              Total Packages
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="p-4 text-center">
            <div className="p-3 bg-green-200 rounded-full w-fit mx-auto mb-4">
              <FileText className="w-8 h-8 text-green-700" />
            </div>
            <div className="text-3xl font-bold text-green-900 mb-2">
              {totalStats.templates}
            </div>
            <div className="text-sm text-green-700 font-medium">
              Total Templates
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
          <CardContent className="p-4 text-center">
            <div className="p-3 bg-purple-200 rounded-full w-fit mx-auto mb-4">
              <Users className="w-8 h-8 text-purple-700" />
            </div>
            <div className="text-3xl font-bold text-purple-900 mb-2">
              {totalStats.clients}
            </div>
            <div className="text-sm text-purple-700 font-medium">
              Total Clients
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-50 to-orange-100">
          <CardContent className="p-4 text-center">
            <div className="p-3 bg-orange-200 rounded-full w-fit mx-auto mb-4">
              <Activity className="w-8 h-8 text-orange-700" />
            </div>
            <div className="text-3xl font-bold text-orange-900 mb-2">
              {totalStats.activeTemplates}
            </div>
            <div className="text-sm text-orange-700 font-medium">
              Active Templates
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Package Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {packageList.map((pkg) => {
          const healthScore = getPackageHealthScore(pkg);

          return (
           <Card
              key={pkg.id}
              className="group overflow-hidden bg-white shadow-lg hover:shadow-2xl transition-all duration-300 border-0 ring-1 ring-gray-200 hover:ring-blue-300 hover:scale-101"
            >
              <CardHeader className="bg-gradient-to-r from-slate-50 via-blue-50 to-indigo-50 pb-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-purple-600/5"></div>
                <div className="relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-sm">
                        <PackageIcon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors leading-tight">
                            {pkg.name || `Package ${pkg.id.slice(0, 8)}`}
                          </h3>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          ID: {pkg.id.slice(0, 8)}...
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Duration:{" "}
                          {pkg.totalMonths
                            ? `${pkg.totalMonths} months`
                            : "N/A"}
                        </p>
                      </div>
                    </div>

                    <div
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 bg-gradient-to-r",
                        getHealthBg(healthScore)
                      )}
                    >
                      <Star
                        className={cn("w-3 h-3", getHealthColor(healthScore))}
                      />
                      <span className={getHealthColor(healthScore)}>
                        {healthScore}%
                      </span>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-3 space-y-6">
                {/* Description */}
                {pkg.description ? (
                  <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">
                    {pkg.description}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 italic">
                    No description provided
                  </p>
                )}

                {/* Main Statistics Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-2 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                    <div className="flex items-center justify-center gap-1 text-blue-600 mb-2">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="text-2xl font-bold text-blue-900">
                      {pkg.stats?.templates ?? 0}
                    </div>
                    <div className="text-xs text-blue-700 font-medium">
                      Templates
                    </div>
                  </div>

                  <div className="text-center p-2 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
                    <div className="flex items-center justify-center gap-1 text-green-600 mb-2">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="text-2xl font-bold text-green-900">
                      {pkg.stats?.clients ?? 0}
                    </div>
                    <div className="text-xs text-green-700 font-medium">
                      Clients
                    </div>
                  </div>
                </div>

                {/* Detailed Statistics */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                    <BarChart3 className="w-3 h-3" />
                    Detailed Stats
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    <div className="text-center p-2 rounded-md border bg-purple-50/50">
                      <div className="flex items-center justify-center gap-1 text-purple-700 mb-0.5">
                        <Activity className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-base font-semibold text-purple-900 leading-tight">
                        {pkg.stats?.activeTemplates ?? 0}
                      </div>
                      <div className="text-[11px] text-purple-700">
                        Active Template
                      </div>
                    </div>

                    <div className="text-center p-2 rounded-md border bg-orange-50/50">
                      <div className="flex items-center justify-center gap-1 text-orange-700 mb-0.5">
                        <Globe className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-base font-semibold text-orange-900 leading-tight">
                        {pkg.stats?.sitesAssets ?? 0}
                      </div>
                      <div className="text-[11px] text-orange-700">
                        Site Assets
                      </div>
                    </div>

                    <div className="text-center p-2 rounded-md border bg-amber-50/50">
                      <div className="flex items-center justify-center gap-1 text-amber-700 mb-0.5">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-base font-semibold text-amber-900 leading-tight">
                        {pkg.stats?.assignments ?? 0}
                      </div>
                      <div className="text-[11px] text-amber-700">
                        Assignments
                      </div>
                    </div>

                    <div className="text-center p-2 rounded-md border bg-teal-50/50">
                      <div className="flex items-center justify-center gap-1 text-teal-700 mb-0.5">
                        <Activity className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-base font-semibold text-teal-900 leading-tight">
                        {pkg.stats?.tasks ?? 0}
                      </div>
                      <div className="text-[11px] text-teal-700">
                        Total Tasks
                      </div>
                    </div>
                  </div>
                </div>

                {/* Package Metadata */}
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>
                        Created:{" "}
                        {pkg.createdAt
                          ? new Date(pkg.createdAt).toLocaleDateString()
                          : "N/A"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      <span>Health: {getPackageHealthScore(pkg)}%</span>
                    </div>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="gap-4">
                <div className="flex gap-2 w-full">
                  <Button
                    variant="outline"
                    className="flex-1 border-blue-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 transition-all duration-200 bg-transparent rounded-lg"
                    onClick={() => handleSeeTemplates(pkg)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Templates
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-green-200 hover:border-green-300 hover:bg-green-50 hover:text-green-600 transition-all duration-200 bg-transparent rounded-lg"
                    onClick={() => handleViewDetails(pkg.id)}
                  >
                    <Info className="h-4 w-4 mr-2" />
                    Details
                  </Button>
                  {canEdit && (
                    <Button
                      variant="outline"
                      className="flex-1 border-purple-200 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-600 transition-all duration-200 bg-transparent rounded-lg"
                      onClick={() => setEditingPackage(pkg)}
                    >
                      <Edit3 className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="destructive"
                      className="flex-1 rounded-lg"
                      onClick={() => deletePackage(pkg.id)}
                      disabled={deletingId === pkg.id}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {deletingId === pkg.id ? "Deleting..." : "Delete"}
                    </Button>
                  )}
                </div>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {!isLoading && packageList.length === 0 && (
        <Card className="border-dashed border-2 border-gray-300 bg-white/50 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-6 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full mb-6">
              <PackageIcon className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-2xl font-semibold text-gray-900 mb-3">
              No packages yet
            </h3>
            <p className="text-gray-500 mb-8 max-w-md text-lg">
              Get started by creating your first package to organize your
              templates and clients.
            </p>
            <Button
              onClick={() => setIsModalOpen(true)}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl px-8"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Package
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      <AddPackageModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={addPackage}
      />

      <AddPackageModal
        isOpen={!!editingPackage}
        onClose={() => setEditingPackage(null)}
        isEdit={true}
        initialData={editingPackage || undefined}
        onUpdate={updatePackage}
        onAdd={() => {}}
      />

      <PackageDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        packageId={selectedPackage || ""}
      />
    </div>
  );
}
