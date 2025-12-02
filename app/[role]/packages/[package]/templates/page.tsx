// app/admin/packages/[package]/templates/page.tsx
// @ts-nocheck

"use client";

import { useState, useMemo, useCallback } from "react";
import useSWR from "swr";
import { useParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Edit3,
  Trash2,
  FileText,
  Package,
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  X,
  RotateCcw,
  Users,
  Globe,
  Share2,
  Eye,
  Sparkles,
  TrendingUp,
  Star,
  Activity,
  Target,
  Copy,
} from "lucide-react";
import { useUserSession } from "@/lib/hooks/use-user-session";
import { hasPermissionClient } from "@/lib/permissions-client";
import { CreateTemplateModal } from "@/components/package/create-template-modal";
import { cn } from "@/lib/utils";
import { TemplateViewModal } from "@/components/package/Template-View-Modal";
import { AssignTemplateModal } from "@/components/package/assign-template-modal";
import { toast } from "sonner";
const TemplateViewModalAny: any = TemplateViewModal;
import DangerDeleteTemplateModal from "@/components/package/DangerDeleteTemplateModal";

interface TemplateSiteAsset {
  id: number;
  type: "social_site" | "web2_site" | "other_asset";
  name: string;
  url?: string;
  description?: string;
  isRequired: boolean;
  defaultPostingFrequency?: number;
  defaultIdealDurationMinutes?: number;
}

interface TemplateTeamMember {
  agentId: string;
  role?: string;
  teamId?: string;
  assignedDate?: Date;
  agent: {
    id: string;
    name?: string;
    email: string;
  };
  team?: {
    id: string;
    name: string;
  };
}

interface Template {
  id: string;
  name: string;
  description?: string | null;
  status?: string | null;
  packageId?: string;
  package?: {
    id: string;
    name: string;
  };
  sitesAssets?: TemplateSiteAsset[];
  templateTeamMembers?: TemplateTeamMember[];
  _count?: {
    sitesAssets: number;
    templateTeamMembers: number;
    assignments: number;
  };
  assignedClients?: Array<{
    id: string;
    name: string | null;
    company: string | null;
    avatar?: string | null;
    status?: string | null;
  }>;
  assignedClientsCount?: number;
  tasksCount: number;
}

type FilterStatus = "all" | "active" | "draft" | "inactive";

export default function TemplateListPage() {
  const { package: slug } = useParams();
  const packageId = String(slug).replace("id-", "");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [viewingTemplate, setViewingTemplate] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { user: currentUser, loading: sessionLoading } = useUserSession();

  const canViewTemplate =
    !sessionLoading &&
    hasPermissionClient(currentUser?.permissions, "template_view");
  const canCreateTemplate =
    !sessionLoading &&
    (hasPermissionClient(currentUser?.permissions, "template_create") ||
      hasPermissionClient(currentUser?.permissions, "template_edit"));
  const canEditTemplate =
    !sessionLoading &&
    hasPermissionClient(currentUser?.permissions, "template_edit");
  const canDeleteTemplate =
    !sessionLoading &&
    hasPermissionClient(currentUser?.permissions, "template_delete");
  const canAssignTemplate =
    !sessionLoading &&
    hasPermissionClient(currentUser?.permissions, "template_assign");
  const canDuplicateTemplate =
    !sessionLoading &&
    hasPermissionClient(currentUser?.permissions, "template_duplicate");

  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [assigningTemplate, setAssigningTemplate] = useState<Template | null>(
    null
  );

  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [targetTemplate, setTargetTemplate] = useState<Template | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ⚡ OPTIMIZED: Use SWR for parallel data fetching with caching
  const jsonFetcher = async (url: string) => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
  };

  // Fetch package name
  const { data: packageData, error: packageError } = useSWR(
    packageId ? `/api/zisanpackages/${packageId}` : null,
    jsonFetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const packageName = packageData?.name || (packageError ? "Package Not Found" : "Loading...");

  // Fetch templates
  const {
    data: rawTemplates = [],
    isLoading: templatesLoading,
    mutate: mutateTemplates,
  } = useSWR<Template[]>(
    packageId ? `/api/zisanpackages/${packageId}/templates?include=full` : null,
    jsonFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      refreshInterval: 60000,
    }
  );

  // ⚡ OPTIMIZED: Memoize filtered templates for current package
  const templates = useMemo(() => {
    return rawTemplates.filter((template: Template) => {
      return template.packageId === packageId || template.package?.id === packageId;
    });
  }, [rawTemplates, packageId]);

  const loading = templatesLoading || !packageData;

  // Filtered and searched templates with additional packageId validation
  const filteredTemplates = useMemo(() => {
    let filtered = templates.filter((template) => {
      // Ensure template belongs to current package
      return (
        template.packageId === packageId || template.package?.id === packageId
      );
    });

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (template) =>
          template.name.toLowerCase().includes(query) ||
          (template.description &&
            template.description.toLowerCase().includes(query))
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(
        (template) => template.status?.toLowerCase() === statusFilter
      );
    }

    return filtered;
  }, [templates, searchQuery, statusFilter, packageId]);

  // ⚡ OPTIMIZED: Use SWR mutate instead of manual fetch
  const reloadTemplates = useCallback(() => {
    mutateTemplates();
  }, [mutateTemplates]);

  // NO browser confirm/alert here
  const handleDeleteTemplate = async () => {
    if (!targetTemplate) return;
    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/templates/${targetTemplate.id}?actorId=${currentUser?.id ?? ""}`,
        {
          method: "DELETE",
          headers: { "x-actor-id": currentUser?.id ?? "" },
        }
      );
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.message || "Failed to delete template");
      }
      toast.success("Template deleted successfully");
      setOpenDeleteModal(false);
      setTargetTemplate(null);
      // ⚡ OPTIMIZED: Use SWR mutate
      await mutateTemplates();
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  };

  const duplicateTemplate = async (templateId: string) => {
    const ok = confirm(
      "Duplicate this template? A draft copy will be created."
    );
    if (!ok) return;

    setDuplicatingId(templateId);
    try {
      const res = await fetch(
        `/api/templates/${templateId}/duplicate?actorId=${
          currentUser?.id ?? ""
        }`,
        {
          method: "POST",
          headers: {
            "x-actor-id": currentUser?.id ?? "",
          },
        }
      );

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.message || "Duplication failed");
      }

      // ⚡ OPTIMIZED: Use SWR mutate
      await mutateTemplates();
      toast.success("Template duplicated successfully");
    } catch (err: any) {
      alert(err?.message || "Duplication failed");
      console.error(err);
    } finally {
      setDuplicatingId(null);
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
  };

  const getStatusBadge = (status: string | null | undefined) => {
    if (!status) return null;
    const statusLower = status.toLowerCase();
    if (statusLower === "active") {
      return (
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Active
        </Badge>
      );
    } else if (statusLower === "draft") {
      return (
        <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200">
          <Clock className="w-3 h-3 mr-1" />
          Draft
        </Badge>
      );
    } else if (statusLower === "inactive") {
      return (
        <Badge
          variant="outline"
          className="bg-slate-100 text-slate-600 border-slate-200"
        >
          <AlertCircle className="w-3 h-3 mr-1" />
          Inactive
        </Badge>
      );
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  const getFilterButtonClass = (filter: FilterStatus) => {
    const baseClass =
      "px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105";
    if (statusFilter === filter) {
      return `${baseClass} bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg`;
    }
    return `${baseClass} bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:shadow-md`;
  };

  const hasActiveFilters = searchQuery.trim() || statusFilter !== "all";

  // Get templates count for current package only
  const currentPackageTemplates = templates.filter((template) => {
    return (
      template.packageId === packageId || template.package?.id === packageId
    );
  });

  // Get site statistics for a template
  const getTemplateStats = (template: Template) => {
    const socialSites =
      template.sitesAssets?.filter((site) => site.type === "social_site")
        .length || 0;
    const web2Sites =
      template.sitesAssets?.filter((site) => site.type === "web2_site")
        .length || 0;
    const otherAssets =
      template.sitesAssets?.filter((site) => site.type === "other_asset")
        .length || 0;

    return { socialSites, web2Sites, otherAssets };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="p-6 max-w-7xl mx-auto space-y-6">
          <div className="space-y-4">
            <Skeleton className="h-10 w-80" />
            <Skeleton className="h-10 w-40" />
            <div className="flex gap-4">
              <Skeleton className="h-10 w-80" />
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <Skeleton className="h-6 w-3/4" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-5 w-16" />
                </CardContent>
                <CardFooter className="pt-4">
                  <div className="flex gap-2 w-full">
                    <Skeleton className="h-9 flex-1" />
                    <Skeleton className="h-9 flex-1" />
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show error state if package not found
  if (packageName === "Package Not Found") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="p-6 max-w-7xl mx-auto">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 bg-red-100 rounded-full mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-red-900 mb-2">
                Package Not Found
              </h3>
              <p className="text-red-700 mb-6 max-w-sm">
                The package you're looking for doesn't exist or you don't have
                access to it.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="p-6 space-y-8">
        {/* Header Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
              <Package className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Templates
              </h1>
              <p className="text-gray-600 mt-2 text-lg">
                Managing templates for{" "}
                <span className="font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {packageName}
                </span>
                <span className="text-sm text-gray-400 ml-2">
                  (ID: {packageId})
                </span>
              </p>
            </div>
          </div>

          {/* Search and Filter Section */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
                {/* Search Input */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    placeholder="Search templates by name or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 pr-12 h-12 text-base border-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-xl"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>

                {/* Filter Buttons */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2 mr-2">
                    <Filter className="w-5 h-5 text-gray-500" />
                    <span className="text-sm text-gray-600 font-medium">
                      Filter:
                    </span>
                  </div>
                  <button
                    onClick={() => setStatusFilter("all")}
                    className={getFilterButtonClass("all")}
                  >
                    All ({currentPackageTemplates.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter("active")}
                    className={getFilterButtonClass("active")}
                  >
                    Active (
                    {
                      currentPackageTemplates.filter(
                        (t) => t.status?.toLowerCase() === "active"
                      ).length
                    }
                    )
                  </button>
                  <button
                    onClick={() => setStatusFilter("draft")}
                    className={getFilterButtonClass("draft")}
                  >
                    Draft (
                    {
                      currentPackageTemplates.filter(
                        (t) => t.status?.toLowerCase() === "draft"
                      ).length
                    }
                    )
                  </button>
                  <button
                    onClick={() => setStatusFilter("inactive")}
                    className={getFilterButtonClass("inactive")}
                  >
                    Inactive (
                    {
                      currentPackageTemplates.filter(
                        (t) => t.status?.toLowerCase() === "inactive"
                      ).length
                    }
                    )
                  </button>
                </div>
              </div>

              {/* Active Filters & Results Count */}
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-100">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Showing{" "}
                    <span className="font-bold text-blue-600">
                      {filteredTemplates.length}
                    </span>{" "}
                    of{" "}
                    <span className="font-bold text-gray-900">
                      {currentPackageTemplates.length}
                    </span>{" "}
                    templates
                  </span>
                  {hasActiveFilters && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearFilters}
                      className="text-gray-600 border-gray-300 hover:bg-gray-50 bg-transparent rounded-lg"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Clear Filters
                    </Button>
                  )}
                </div>

                {canCreateTemplate && (
                  <Button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 rounded-xl px-6"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Template
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Templates Grid */}
        {filteredTemplates.length === 0 ? (
          <Card className="border-dashed border-2 border-gray-300 bg-white/50 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-6 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full mb-6">
                {hasActiveFilters ? (
                  <Search className="w-12 h-12 text-gray-400" />
                ) : (
                  <FileText className="w-12 h-12 text-gray-400" />
                )}
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                {hasActiveFilters ? "No templates found" : "No templates yet"}
              </h3>
              <p className="text-gray-500 mb-8 max-w-md text-lg">
                {hasActiveFilters
                  ? "Try adjusting your search or filter criteria to find what you're looking for."
                  : "Get started by creating your first template for this package."}
              </p>
              {hasActiveFilters ? (
                <Button
                  onClick={clearFilters}
                  variant="outline"
                  size="lg"
                  className="border-blue-200 text-blue-600 hover:bg-blue-50 bg-transparent rounded-xl px-8"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Clear Filters
                </Button>
              ) : (
                canCreateTemplate && (
                  <Button
                    onClick={() => setIsCreateModalOpen(true)}
                    size="lg"
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl px-8"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Template
                  </Button>
                )
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredTemplates.map((template) => {
              const stats = getTemplateStats(template);
              // Detect if this is a customized template
              const isCustomized = template.description?.includes("Custom template for client:") || false;
              const isMainTemplate = !isCustomized;
              
              return (
                <Card
                  key={template.id}
                  className={cn(
                    "group overflow-hidden backdrop-blur-sm shadow-lg hover:shadow-2xl transition-all duration-300 border-0 ring-2 hover:scale-101",
                    isCustomized 
                      ? "bg-gradient-to-br from-purple-50 to-pink-50 ring-purple-300 hover:ring-purple-400"
                      : "bg-white/90 ring-gray-200 hover:ring-blue-300"
                  )}
                >
                  <CardHeader className={cn(
                    "pb-4 relative overflow-hidden",
                    isCustomized
                      ? "bg-gradient-to-r from-purple-100 via-pink-100 to-purple-100"
                      : "bg-gradient-to-r from-slate-50 via-blue-50 to-indigo-50"
                  )}>
                    <div className={cn(
                      "absolute inset-0",
                      isCustomized
                        ? "bg-gradient-to-r from-purple-600/10 to-pink-600/10"
                        : "bg-gradient-to-r from-blue-600/5 to-purple-600/5"
                    )}></div>
                    <div className="relative">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-2 rounded-lg shadow-sm",
                            isCustomized
                              ? "bg-gradient-to-br from-purple-500 to-pink-600"
                              : "bg-gradient-to-br from-blue-500 to-purple-600"
                          )}>
                            {isCustomized ? (
                              <Sparkles className="w-5 h-5 text-white" />
                            ) : (
                              <FileText className="w-5 h-5 text-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className={cn(
                                "font-bold group-hover:text-blue-600 transition-colors text-lg leading-tight",
                                isCustomized ? "text-purple-900" : "text-gray-900"
                              )}>
                                {template.name}
                              </h3>
                              {isCustomized && (
                                <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs px-2 py-0.5 flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" />
                                  Customized
                                </Badge>
                              )}
                              {isMainTemplate && (
                                <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 text-xs px-2 py-0.5 flex items-center gap-1">
                                  <Star className="w-3 h-3" />
                                  Main
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              Template ID: {template.id.slice(0, 8)}...
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(template.status)}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-6 space-y-5">
                    {template.description ? (
                      <div className="space-y-2">
                        {isCustomized && (
                          <div className="flex items-start gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                            <Sparkles className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs font-semibold text-purple-900 mb-1">Customized Template</p>
                              <p className="text-xs text-purple-700 leading-relaxed">
                                {template.description.replace("Custom template for client: ", "").split(".")[0]}
                              </p>
                            </div>
                          </div>
                        )}
                        {!isCustomized && (
                          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <Star className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-blue-900 leading-relaxed line-clamp-2">
                              {template.description}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 italic">
                        No description provided
                      </p>
                    )}

                    {/* Detailed Site Statistics */}
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          Site Breakdown
                        </h4>
                        <div className="flex items-center gap-2 text-sm">
                          <div className="p-1.5 bg-amber-100 rounded-md">
                            <Users className="w-3 h-3 text-amber-600" />
                          </div>
                          <span className="text-gray-600">Clients:</span>
                          <span className="font-semibold text-amber-700">
                            {template.assignedClientsCount ?? 0}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                          <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
                            <Share2 className="w-3 h-3" />
                          </div>
                          <div className="text-lg font-bold text-blue-900">
                            {stats.socialSites}
                          </div>
                          <div className="text-xs text-blue-700 font-medium">
                            Social
                          </div>
                        </div>
                        <div className="text-center p-3 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
                          <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                            <Globe className="w-3 h-3" />
                          </div>
                          <div className="text-lg font-bold text-green-900">
                            {stats.web2Sites}
                          </div>
                          <div className="text-xs text-green-700 font-medium">
                            Web 2.0
                          </div>
                        </div>
                        <div className="text-center p-3 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200">
                          <div className="flex items-center justify-center gap-1 text-purple-600 mb-1">
                            <FileText className="w-3 h-3" />
                          </div>
                          <div className="text-lg font-bold text-purple-900">
                            {stats.otherAssets}
                          </div>
                          <div className="text-xs text-purple-700 font-medium">
                            Other
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Team, Assignments & Tasks — compact chips */}
                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100">
                      {/* Team */}
                      <div
                        className="group flex items-center justify-between rounded-lg border bg-white px-2.5 py-2 hover:shadow-sm transition"
                        aria-label="Team members on this template"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-orange-50 border border-orange-200">
                            <Users className="h-3.5 w-3.5 text-orange-600" />
                          </span>
                          <span className="text-[11px] leading-none text-gray-600">
                            Assets
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-orange-700 tabular-nums">
                          {template._count?.sitesAssets ??
                            template.sitesAssets?.length ??
                            0}
                        </span>
                      </div>

                      {/* Assignments */}
                      <div
                        className="group flex items-center justify-between rounded-lg border bg-white px-2.5 py-2 hover:shadow-sm transition"
                        aria-label="Assignments on this template"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-indigo-50 border border-indigo-200">
                            <Activity className="h-3.5 w-3.5 text-indigo-600" />
                          </span>
                          <span className="text-[11px] leading-none text-gray-600">
                            Assignments
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-indigo-700 tabular-nums">
                          {template._count?.assignments ?? 0}
                        </span>
                      </div>

                      {/* Tasks */}
                      <div
                        className="group flex items-center justify-between rounded-lg border bg-white px-2.5 py-2 hover:shadow-sm transition"
                        aria-label="Tasks on this template"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 border border-blue-200">
                            <Target className="h-3.5 w-3.5 text-blue-600" />
                          </span>
                          <span className="text-[11px] leading-none text-gray-600">
                            Tasks
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-blue-700 tabular-nums">
                          {template.tasksCount ?? 0}
                        </span>
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="p-4 pt-0">
                    <div className="flex gap-2 w-full ">
                      {/* View Button */}

                      {canViewTemplate && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-blue-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 transition-all duration-200 bg-transparent rounded-lg"
                          onClick={() => setViewingTemplate(template)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      )}

                      {canEditTemplate && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-green-200 hover:border-green-300 hover:bg-green-50 hover:text-green-600 transition-all duration-200 bg-transparent rounded-lg"
                          onClick={() => setEditingTemplate(template)}
                        >
                          <Edit3 className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                      )}

                      {canDeleteTemplate && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-red-200 hover:border-red-300 hover:bg-red-50 hover:text-red-600 transition-all duration-200 bg-transparent rounded-lg px-3"
                          onClick={() => {
                            setTargetTemplate(template);
                            setOpenDeleteModal(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}

                      {canAssignTemplate && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-indigo-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 transition-all duration-200 bg-transparent rounded-lg px-3"
                          onClick={() => setAssigningTemplate(template)}
                        >
                          <Users className="w-4 h-4 mr-1" />
                          Assign
                        </Button>
                      )}
                      {canDuplicateTemplate && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-teal-200 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-600 transition-all duration-200 bg-transparent rounded-lg px-3"
                          onClick={() => duplicateTemplate(template.id)}
                          disabled={duplicatingId === template.id}
                        >
                          {duplicatingId === template.id ? (
                            <div className="w-4 h-4 animate-spin rounded-full border-2 border-teal-300 border-t-teal-600" />
                          ) : (
                            <Copy className="w-4 h-4 mr-1" />
                          )}
                          {duplicatingId === template.id
                            ? "Duplicating..."
                            : "Duplicate"}
                        </Button>
                      )}
                    </div>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}

        {/* Modals */}
        <CreateTemplateModal
          isOpen={isCreateModalOpen || !!editingTemplate}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingTemplate(null);
          }}
          packageId={packageId}
          onCreated={reloadTemplates}
          initialData={editingTemplate}
          isEditMode={!!editingTemplate}
        />

        <TemplateViewModalAny
          isOpen={!!viewingTemplate}
          onClose={() => setViewingTemplate(null)}
          template={viewingTemplate as any}
        />

        <AssignTemplateModal
          isOpen={!!assigningTemplate}
          onClose={() => setAssigningTemplate(null)}
          templateId={assigningTemplate?.id || ""}
          templateName={assigningTemplate?.name || ""}
          packageId={assigningTemplate?.packageId || ""}
          onAssignComplete={(clientId) => {
            setAssigningTemplate(null);
            reloadTemplates(); // optional refresh
          }}
        />

        <DangerDeleteTemplateModal
          open={openDeleteModal}
          onOpenChange={(v) => {
            if (!v) setTargetTemplate(null);
            setOpenDeleteModal(v);
          }}
          templateId={targetTemplate?.id || ""}
          templateName={targetTemplate?.name || ""}
          isDeleting={isDeleting}
          onConfirm={handleDeleteTemplate}
        />
      </div>
    </div>
  );
}
