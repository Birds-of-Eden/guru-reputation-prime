"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText,
  Globe,
  Users,
  Target,
  Clock,
  CheckCircle2,
  AlertCircle,
  Share2,
  Package,
  Activity,
  Palette,
  Edit3,
  PenTool,
  Link2,
  CheckSquare,
  Video,
  Monitor,
  StarOff,
  BarChart3,
  Zap,
  LayoutGrid,
  Settings,
  BarChart2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TemplateSiteAsset {
  id: number;
  type:
    | "social_site"
    | "web2_site"
    | "other_asset"
    | "graphics_design"
    | "image_optimization"
    | "content_studio"
    | "content_writing"
    | "backlinks"
    | "completed_com"
    | "youtube_video_optimization"
    | "monitoring"
    | "review_removal"
    | "summary_report"
    | "guest_posting";

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
}

interface TemplateViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: Template | null;
}

export function TemplateViewModal({
  isOpen,
  onClose,
  template,
}: TemplateViewModalProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedSiteType, setSelectedSiteType] = useState<string | null>(null);

  if (!template) return null;

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSelectedSiteType(null); // Reset filter when switching tabs
  };

  const getStatusBadge = (status: string | null | undefined) => {
    if (!status) return null;
    const statusLower = status.toLowerCase();
    if (statusLower === "active") {
      return (
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 px-3 py-1">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Active
        </Badge>
      );
    } else if (statusLower === "draft") {
      return (
        <Badge className="bg-amber-100 text-amber-700 border-amber-200 px-3 py-1">
          <Clock className="w-3 h-3 mr-1" />
          Draft
        </Badge>
      );
    } else if (statusLower === "inactive") {
      return (
        <Badge className="bg-slate-100 text-slate-600 border-slate-200 px-3 py-1">
          <AlertCircle className="w-3 h-3 mr-1" />
          Inactive
        </Badge>
      );
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  const getSiteTypeConfig = (type: string) => {
    const configs = {
      social_site: { icon: Share2, color: "blue", label: "Social Media" },
      web2_site: { icon: Globe, color: "green", label: "Web 2.0" },
      other_asset: { icon: FileText, color: "purple", label: "Assets" },
      graphics_design: { icon: Palette, color: "pink", label: "Design" },
      image_optimization: {
        icon: Palette,
        color: "pink",
        label: "Image Optimization",
      },
      content_studio: { icon: Edit3, color: "indigo", label: "Content Studio" },
      content_writing: { icon: PenTool, color: "orange", label: "Writing" },
      backlinks: { icon: Link2, color: "teal", label: "Backlinks" },
      completed_com: { icon: CheckSquare, color: "lime", label: "Completed" },
      youtube_video_optimization: {
        icon: Video,
        color: "red",
        label: "YouTube",
      },
      monitoring: { icon: Monitor, color: "cyan", label: "Monitoring" },
      review_removal: {
        icon: StarOff,
        color: "amber",
        label: "Review Removal",
      },
      summary_report: {
        icon: BarChart3,
        color: "gray",
        label: "Summary Reports",
      },
      guest_posting: {
        icon: BarChart2,
        color: "gray",
        label: "Guest Postings",
      },
    };

    return (
      configs[type as keyof typeof configs] || {
        icon: FileText,
        color: "gray",
        label: "Other",
      }
    );
  };

  const SiteTypeIcon = ({
    type,
    size = 16,
  }: {
    type: string;
    size?: number;
  }) => {
    const Config = getSiteTypeConfig(type);
    return (
      <Config.icon size={size} className={cn(`text-${Config.color}-600`)} />
    );
  };

  // Group sites by type
  const groupedSites =
    template.sitesAssets?.reduce((acc, site) => {
      if (!acc[site.type]) {
        acc[site.type] = [];
      }
      acc[site.type].push(site);
      return acc;
    }, {} as Record<string, TemplateSiteAsset[]>) || {};

  const socialSites = groupedSites.social_site || [];
  const web2Sites = groupedSites.web2_site || [];
  const otherAssets = groupedSites.other_asset || [];

  const otherTasks = [
    ...(groupedSites.graphics_design || []),
    ...(groupedSites.image_optimization || []),
    ...(groupedSites.content_studio || []),
    ...(groupedSites.content_writing || []),
    ...(groupedSites.backlinks || []),
    ...(groupedSites.completed_com || []),
    ...(groupedSites.youtube_video_optimization || []),
    ...(groupedSites.monitoring || []),
    ...(groupedSites.review_removal || []),
    ...(groupedSites.summary_report || []),
    ...(groupedSites.guest_posting || []),
  ];

  const totalSites = template.sitesAssets?.length || 0;
  const requiredSites =
    template.sitesAssets?.filter((site) => site.isRequired).length || 0;

  // Filter sites for the "All Sites" tab based on the selected type
  const filteredSites = selectedSiteType
    ? template.sitesAssets?.filter((site) => site.type === selectedSiteType)
    : template.sitesAssets;

  const StatCard = ({
    icon: Icon,
    value,
    label,
    color = "blue",
    trend,
  }: {
    icon: any;
    value: number;
    label: string;
    color?: string;
    trend?: string;
  }) => (
    <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50 hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className={`p-2 bg-${color}-100 rounded-lg`}>
            <Icon className={`w-5 h-5 text-${color}-600`} />
          </div>
          {trend && (
            <Badge
              variant="outline"
              className={`text-xs bg-${color}-50 border-${color}-200`}
            >
              {trend}
            </Badge>
          )}
        </div>
        <div className="mt-3">
          <div className="text-2xl font-bold text-gray-900">{value}</div>
          <div className="text-sm text-gray-600 font-medium">{label}</div>
        </div>
      </CardContent>
    </Card>
  );

  const SiteCard = ({ site }: { site: TemplateSiteAsset }) => {
    const config = getSiteTypeConfig(site.type);
    return (
      <Card className="border-0 shadow-xs hover:shadow-sm transition-all duration-200 bg-white">
        <CardContent className="p-3">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div
                className={`p-1.5 bg-${config.color}-100 rounded-md flex-shrink-0`}
              >
                <SiteTypeIcon type={site.type} size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-medium text-gray-900 text-sm truncate">
                  {site.name}
                </h4>
                {site.url && (
                  <a
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-500 hover:text-gray-700 truncate block"
                    title={site.url}
                  >
                    {(() => {
                      try {
                        return new URL(site.url).hostname;
                      } catch {
                        return site.url;
                      }
                    })()}
                  </a>
                )}
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "text-xs flex-shrink-0 ml-2",
                site.isRequired
                  ? "bg-red-50 text-red-700 border-red-200"
                  : "bg-gray-50 text-gray-600 border-gray-200"
              )}
            >
              {site.isRequired ? "Required" : "Optional"}
            </Badge>
          </div>

          {site.description && (
            <p className="text-xs text-gray-600 mb-2 line-clamp-2">
              {site.description}
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Target className="w-3 h-3" />
                {site.defaultPostingFrequency || 0}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {site.defaultIdealDurationMinutes || 0}m
              </span>
            </div>
            <Badge
              variant="outline"
              className={`text-xs bg-${config.color}-50 border-${config.color}-200 text-${config.color}-700`}
            >
              {config.label}
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[85vh] overflow-hidden p-0 bg-white flex flex-col">
        {/* Header remains fixed at the top */}
        <DialogHeader className="p-4 border-b bg-white/80 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-gray-900">
                  {template.name}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  {getStatusBadge(template.status)}
                  <Badge variant="outline" className="text-xs bg-blue-50">
                    <Package className="w-3 h-3 mr-1" />
                    {template.package?.name || "No Package"}
                  </Badge>
                  <span className="text-xs text-gray-500">
                    {template.sitesAssets?.length || 0} total sites
                  </span>
                </div>
              </div>
            </div>
          </div>

          {template.description && (
            <p className="text-sm text-gray-600 mt-2 leading-relaxed">
              {template.description}
            </p>
          )}
        </DialogHeader>

        {/* Tabs component wrapper to manage layout */}
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="flex-1 flex flex-col overflow-hidden"
        >
          {/* TabsList remains fixed below the header */}
          <div className="px-4 border-b bg-slate-50">
            <TabsList className="grid w-full text-white grid-cols-3 h-11 bg-blue-200 rounded-lg p-1 gap-1">
              {/* Overview Tab */}
              <TabsTrigger
                value="overview"
                className="text-slate-600 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-md rounded-md text-sm font-medium transition-all duration-200"
              >
                <Activity className="w-4 h-4 mr-2" />
                Overview
              </TabsTrigger>

              {/* All Sites Tab */}
              <TabsTrigger
                value="sites"
                className="text-slate-600 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-md rounded-md text-sm font-medium transition-all duration-200"
              >
                <LayoutGrid className="w-4 h-4 mr-2" />
                All Sites ({totalSites})
              </TabsTrigger>

              {/* Tasks Tab */}
              <TabsTrigger
                value="otherTasks"
                className="text-slate-600 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-md rounded-md text-sm font-medium transition-all duration-200"
              >
                <Settings className="w-4 h-4 mr-2" />
                Tasks ({otherTasks.length})
              </TabsTrigger>
            </TabsList>
          </div>

          {/* This container scrolls, holding all tab content */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            <TabsContent value="overview" className="mt-0 space-y-4">
              {/* Quick Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                  icon={Share2}
                  value={socialSites.length}
                  label="Social Media"
                  color="blue"
                  trend={`${Math.round(
                    (socialSites.length / (totalSites || 1)) * 100
                  )}%`}
                />
                <StatCard
                  icon={Globe}
                  value={web2Sites.length}
                  label="Web 2.0"
                  color="green"
                  trend={`${Math.round(
                    (web2Sites.length / (totalSites || 1)) * 100
                  )}%`}
                />
                <StatCard
                  icon={FileText}
                  value={otherAssets.length}
                  label="Assets"
                  color="purple"
                  trend={`${Math.round(
                    (otherAssets.length / (totalSites || 1)) * 100
                  )}%`}
                />
                <StatCard
                  icon={Zap}
                  value={otherTasks.length}
                  label="Other Tasks"
                  color="orange"
                  trend={`${Math.round(
                    (otherTasks.length / (totalSites || 1)) * 100
                  )}%`}
                />
              </div>

              {/* Requirements Summary */}
              <Card className="border-0 shadow-sm bg-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="w-5 h-5 text-blue-600" />
                    Requirements Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                      <div className="text-2xl font-bold text-blue-900">
                        {totalSites}
                      </div>
                      <div className="text-sm text-blue-700">Total Sites</div>
                    </div>
                    <div className="text-center p-3 bg-gradient-to-br from-red-50 to-red-100 rounded-lg">
                      <div className="text-2xl font-bold text-red-900">
                        {requiredSites}
                      </div>
                      <div className="text-sm text-red-700">Required</div>
                    </div>
                    <div className="text-center p-3 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                      <div className="text-2xl font-bold text-green-900">
                        {totalSites - requiredSites}
                      </div>
                      <div className="text-sm text-green-700">Optional</div>
                    </div>
                    <div className="text-center p-3 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg">
                      <div className="text-2xl font-bold text-gray-900">
                        {template._count?.assignments || 0}
                      </div>
                      <div className="text-sm text-gray-700">Assignments</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sites" className="mt-0 space-y-4">
              {/* Site Type Filters */}
              <div className="flex flex-wrap gap-2 items-center">
                <Badge
                  onClick={() => setSelectedSiteType(null)}
                  variant="outline"
                  className={cn(
                    "cursor-pointer text-sm py-1 px-3",
                    !selectedSiteType
                      ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                  )}
                >
                  All ({totalSites})
                </Badge>
                {Object.entries(groupedSites).map(([type, sites]) => {
                  const config = getSiteTypeConfig(type);
                  return (
                    <Badge
                      key={type}
                      variant="outline"
                      onClick={() =>
                        setSelectedSiteType(
                          type === selectedSiteType ? null : type
                        )
                      }
                      className={cn(
                        `cursor-pointer py-1 px-2 border-2`,
                        `bg-${config.color}-50 border-${config.color}-200 text-${config.color}-800 hover:bg-${config.color}-100`,
                        selectedSiteType === type &&
                          `ring-2 ring-offset-1 ring-${config.color}-400 border-transparent`
                      )}
                    >
                      <SiteTypeIcon type={type} size={14} />
                      <span className="ml-1.5 font-medium">{config.label}</span>
                      <span className="ml-2 bg-white/60 px-1.5 rounded-full text-xs font-semibold">
                        {sites.length}
                      </span>
                    </Badge>
                  );
                })}
              </div>

              {/* All Sites Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredSites?.map((site) => (
                  <SiteCard key={site.id} site={site} />
                ))}
              </div>

              {!filteredSites?.length && (
                <Card className="border-dashed border-2 border-gray-300 bg-white/50">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <Globe className="w-12 h-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      No Sites Found
                    </h3>
                    <p className="text-gray-500">
                      There are no sites matching the selected filter.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="otherTasks" className="mt-0 space-y-4">
              {/* Task Categories */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  "graphics_design",
                  "image_optimization",
                  "content_studio",
                  "content_writing",
                  "backlinks",
                  "completed_com",
                  "youtube_video_optimization",
                  "monitoring",
                  "review_removal",
                  "summary_report",
                  "guest_posting",
                ].map((type) => {
                  const config = getSiteTypeConfig(type);
                  const sites = groupedSites[type] || [];
                  if (sites.length === 0) return null;

                  return (
                    <Card
                      key={type}
                      className="border-0 shadow-sm bg-white text-center hover:shadow-md transition-shadow"
                    >
                      <CardContent className="p-4">
                        <div
                          className={`p-3 bg-${config.color}-100 rounded-full w-fit mx-auto mb-3`}
                        >
                          <SiteTypeIcon type={type} size={20} />
                        </div>
                        <div className="text-lg font-bold text-gray-900">
                          {sites.length}
                        </div>
                        <div className="text-sm text-gray-600 font-medium">
                          {config.label}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Task Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {otherTasks.map((site) => (
                  <SiteCard key={site.id} site={site} />
                ))}
              </div>

              {otherTasks.length === 0 && (
                <Card className="border-dashed border-2 border-gray-300 bg-white/50">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <Settings className="w-12 h-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      No Tasks Configured
                    </h3>
                    <p className="text-gray-500">
                      This template doesn't have any additional tasks yet.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
