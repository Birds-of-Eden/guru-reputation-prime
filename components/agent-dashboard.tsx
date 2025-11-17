"use client";

import type React from "react";
import { useState, useMemo } from "react";
import useSWR from "swr";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MoveUp,
  CheckCircle2,
  Users,
  Layers,
  Target,
  Clock,
  TrendingUp,
  Download,
  FileText,
  ChevronDown,
  RefreshCw,
  AlertCircle,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// ---------- Types & helpers (aligned with API route) ----------

type StatusCounts = {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  overdue: number;
  cancelled: number;
  reassigned: number;
  qc_approved: number;
};

const EMPTY_COUNTS: StatusCounts = {
  total: 0,
  pending: 0,
  in_progress: 0,
  completed: 0,
  overdue: 0,
  cancelled: 0,
  reassigned: 0,
  qc_approved: 0,
};

function normalizeCounts(input?: Partial<StatusCounts> | null): StatusCounts {
  const c = input ?? {};
  return {
    total: c.total ?? 0,
    pending: c.pending ?? 0,
    in_progress: c.in_progress ?? 0,
    completed: c.completed ?? 0,
    overdue: c.overdue ?? 0,
    cancelled: c.cancelled ?? 0,
    reassigned: c.reassigned ?? 0,
    qc_approved: c.qc_approved ?? 0,
  };
}

type PriorityCounts = {
  low: number;
  medium: number;
  high: number;
  urgent: number;
};

const EMPTY_PRIORITY_COUNTS: PriorityCounts = {
  low: 0,
  medium: 0,
  high: 0,
  urgent: 0,
};

// ---- API payload type (same as route.ts) ----
interface AgentClient {
  id: string;
  name: string;
  company?: string | null;
  designation?: string | null;
  avatar?: string | null;
  status: string | null;
  imageDrivelink?: string | null;
  package?: { id: string; name: string } | null;

  progress?: number | null;
  taskCounts?: Partial<StatusCounts> | null;
  agentTaskCounts?: Partial<StatusCounts> | null;
  priorityCounts?: PriorityCounts | null;

  credentials?: {
    email: string | null;
    username: string | null;
    password: string | null;
  };
  completionLink?: string | null;
  asset?: string | null;
  assetUrl?: string | null;
  url?: string | null;
  siteAsset?: {
    id: number;
    name: string;
    url: string | null;
    type: string;
  } | null;
}

interface AgentDashboardData {
  totalAssignedClients: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  reassignedTasks: number;
  qcApprovedTasks: number; // NEW: overall QC approved count
  overallCompletionRate: number;
  averageClientProgress: number;
  recentClients: (AgentClient & {
    _counts: StatusCounts;
    _agentProgress: number; // overall progress
    _qcProgress: number; // NEW: qc_approved ভিত্তিক progress
  })[];
  clientsNeedingAttention: (AgentClient & {
    _counts: StatusCounts;
    _agentProgress: number;
    _qcProgress: number;
  })[];
  highPrioritySummary: {
    clientId: string;
    clientName: string;
    high: number;
    urgent: number;
  }[];
}

interface AgentDashboardProps {
  agentId: string;
}

// Fetcher
const agentDashboardFetcher = async (url: string): Promise<AgentClient[]> => {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch agent data: ${response.statusText}`);
  }
  return response.json();
};

export function AgentDashboard({ agentId }: AgentDashboardProps) {
  const [timeRange, setTimeRange] = useState("month"); // UI only

  const {
    data: rawClients,
    isLoading: loading,
    error: fetchError,
  } = useSWR<AgentClient[]>(
    agentId ? `/api/tasks/clients/agents/${agentId}` : null,
    agentDashboardFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      refreshInterval: 60000,
    }
  );

  const error = fetchError
    ? fetchError instanceof Error
      ? fetchError.message
      : "Failed to fetch dashboard data"
    : null;

  const dashboardData: AgentDashboardData | null = useMemo(() => {
    if (!rawClients) return null;

    try {
      const clients = rawClients.map((c) => {
        const counts = normalizeCounts(c.agentTaskCounts ?? c.taskCounts ?? EMPTY_COUNTS);

        // overall completion (completed / total)
        const derivedFromCounts =
          counts.total > 0
            ? Math.round((counts.completed / counts.total) * 100)
            : 0;

        // ✅ QC-based progress (qc_approved / total)
        const qcProgress =
          counts.total > 0
            ? Math.round((counts.qc_approved / counts.total) * 100)
            : 0;

        const finalProgress =
          typeof c.progress === "number" ? c.progress : derivedFromCounts;

        return {
          ...c,
          _counts: counts,
          _agentProgress: finalProgress, // existing overall progress
          _qcProgress: qcProgress, // NEW: qc-based progress
        };
      });

      let totalTasks = 0;
      let completedTasks = 0;
      let pendingTasks = 0;
      let inProgressTasks = 0;
      let reassignedTasks = 0;
      let qcApprovedTasks = 0; // NEW
      let totalProgress = 0;

      const clientsNeedingAttention: typeof clients = [];
      const highPrioritySummaryMap = new Map<
        string,
        { clientId: string; clientName: string; high: number; urgent: number }
      >();

      clients.forEach((client) => {
        const counts = client._counts;

        totalTasks += counts.total;
        completedTasks += counts.completed;
        pendingTasks += counts.pending;
        inProgressTasks += counts.in_progress;
        reassignedTasks += counts.reassigned;
        qcApprovedTasks += counts.qc_approved; // NEW
        totalProgress += client._agentProgress;

        const hasOverdue = counts.overdue > 0;

        // ✅ attention criteria e ekhono offline progress r overdue diteitese,
        // chaile _qcProgress diye o korar scope ache
        if (client._qcProgress < 30 || hasOverdue) {
          clientsNeedingAttention.push(client);
        }

        const pCounts = client.priorityCounts ?? EMPTY_PRIORITY_COUNTS;
        if (pCounts.high > 0 || pCounts.urgent > 0) {
          highPrioritySummaryMap.set(client.id, {
            clientId: client.id,
            clientName: client.name,
            high: pCounts.high,
            urgent: pCounts.urgent,
          });
        }
      });

      const overallCompletionRate =
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      const averageClientProgress =
        clients.length > 0 ? Math.round(totalProgress / clients.length) : 0;

      const highPrioritySummary = Array.from(highPrioritySummaryMap.values());

      return {
        totalAssignedClients: clients.length,
        totalTasks,
        completedTasks,
        pendingTasks,
        inProgressTasks,
        reassignedTasks,
        qcApprovedTasks,
        overallCompletionRate,
        averageClientProgress,
        recentClients: clients.slice(0, 5),
        clientsNeedingAttention: clientsNeedingAttention.slice(0, 5),
        highPrioritySummary,
      };
    } catch (e) {
      console.error("Error processing agent dashboard data:", e);
      return null;
    }
  }, [rawClients, timeRange]);

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600 mb-4">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Error Loading Dashboard</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => window.location.reload()} className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent pa-3">
            Agent Performance Dashboard
          </h2>
          <p className="text-muted-foreground mt-2">
            Track your assigned clients and task performance
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center w-full md:w-auto">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-slate-300 bg-transparent"
            >
              <Download className="h-4 w-4" />
              Export Report
            </Button>
            <Button
              size="sm"
              className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600"
            >
              <FileText className="h-4 w-4" />
              Performance Summary
            </Button>
          </div>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-full sm:w-[180px] border-slate-300">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Last Week</SelectItem>
              <SelectItem value="month">Last Month</SelectItem>
              <SelectItem value="quarter">Last Quarter</SelectItem>
              <SelectItem value="year">Last Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard
          title="Assigned Clients"
          value={(dashboardData?.totalAssignedClients ?? 0).toString()}
          change={`${dashboardData?.averageClientProgress ?? 0}%`}
          trend="up"
          description="avg. progress"
          icon={<Users className="h-6 w-6" />}
          gradient="from-blue-500 to-cyan-500"
        />
        <MetricCard
          title="Total Tasks"
          value={(dashboardData?.totalTasks ?? 0).toString()}
          change={`${dashboardData?.overallCompletionRate ?? 0}%`}
          trend="up"
          description="completion rate"
          icon={<Layers className="h-6 w-6" />}
          gradient="from-violet-500 to-purple-500"
        />
        <MetricCard
          title="Completed Tasks"
          value={(dashboardData?.completedTasks ?? 0).toString()}
          change={`${dashboardData?.pendingTasks ?? 0}`}
          trend="up"
          description="pending tasks"
          icon={<CheckCircle2 className="h-6 w-6" />}
          gradient="from-emerald-500 to-green-500"
        />
        <MetricCard
          title="Reassigned Tasks"
          value={(dashboardData?.reassignedTasks ?? 0).toString()}
          change={`${dashboardData?.inProgressTasks ?? 0}`}
          trend="up"
          description="in progress"
          icon={<RefreshCw className="h-6 w-6" />}
          gradient="from-amber-500 to-orange-500"
        />
      </div>

      {/* Middle section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Status Overview */}
        <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-gradient-to-br from-white to-blue-50/50 backdrop-blur-sm">
          <CardHeader className="border-b border-slate-200/70 py-5 bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  Task Status Overview
                </CardTitle>
                <CardDescription className="text-slate-500">
                  Your current task distribution
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-slate-600"
              >
                View details <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-5">
                <BarRow
                label="QC Approved"
                value={dashboardData?.qcApprovedTasks ?? 0}
                total={dashboardData?.totalTasks ?? 0}
                barClass="bg-indigo-500" // NEW colour for QC
              />
              <BarRow
                label="Completed"
                value={dashboardData?.completedTasks ?? 0}
                total={dashboardData?.totalTasks ?? 0}
                barClass="bg-emerald-500"
              />
            
              <BarRow
                label="In Progress"
                value={dashboardData?.inProgressTasks ?? 0}
                total={dashboardData?.totalTasks ?? 0}
                barClass="bg-blue-500"
              />
              <BarRow
                label="Pending"
                value={dashboardData?.pendingTasks ?? 0}
                total={dashboardData?.totalTasks ?? 0}
                barClass="bg-amber-500"
              />
              <BarRow
                label="Reassigned"
                value={dashboardData?.reassignedTasks ?? 0}
                total={dashboardData?.totalTasks ?? 0}
                barClass="bg-red-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Client Progress Distribution (QC-based) */}
        <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-gradient-to-br from-white to-purple-50/50 backdrop-blur-sm">
          <CardHeader className="border-b border-slate-200/70 py-5 bg-gradient-to-r from-purple-50/50 to-violet-50/50">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <Target className="h-5 w-5 text-purple-600" />
                  Client Progress Distribution
                </CardTitle>
                <CardDescription className="text-slate-500">
                  QC approved progress across clients
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-slate-600"
              >
                View details <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-5">
              {(dashboardData?.recentClients ?? [])
                .slice(0, 4)
                .map((client) => (
                  <div key={client.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">
                        {client.name}
                      </span>
                      <span className="text-sm text-slate-500">
                        {client._qcProgress}% QC approved
                      </span>
                    </div>
                    <Progress
                      value={client._qcProgress}
                      className="h-2 bg-slate-200 [&>div]:bg-gradient-to-r [&>div]:from-purple-500 [&>div]:to-violet-500 [&>div]:rounded-full"
                    />
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assigned Clients (QC-based progress) */}
        <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-gradient-to-br from-white to-slate-50/50 backdrop-blur-sm">
          <CardHeader className="border-b border-slate-200/70 py-5 bg-gradient-to-r from-slate-50/50 to-slate-100/50">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  Assigned Clients
                </CardTitle>
                <CardDescription className="text-slate-500">
                  QC approval status per client
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-slate-600"
              >
                View all <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            <div className="space-y-4">
              {(dashboardData?.recentClients ?? []).map((client) => {
                const status = (client.status ?? "pending").toLowerCase();
                const badgeCls =
                  status === "active"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 font-medium"
                    : "bg-slate-100 text-slate-700 border-slate-200 font-medium";
                return (
                  <div
                    key={client.id}
                    className="flex items-center justify-between p-3 rounded-lg transition-all duration-200 hover:bg-slate-100/50"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                        <AvatarFallback className="bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-800 font-medium">
                          {client.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-slate-800">
                          {client.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {client.package?.name || "No package"} •{" "}
                          {client._counts.total} tasks
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-sm font-medium text-slate-700">
                          {client._qcProgress}%
                        </p>
                        <p className="text-xs text-slate-500">QC approved</p>
                      </div>
                      <Badge variant="outline" className={badgeCls}>
                        {client.status || "unknown"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* High Priority Summary (same as before) */}
        <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-gradient-to-br from-white to-slate-50/50 backdrop-blur-sm">
          <CardHeader className="border-b border-slate-200/70 py-5 bg-gradient-to-r from-slate-50/50 to-slate-100/50">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-600" />
                  High Priority Tasks
                </CardTitle>
                <CardDescription className="text-slate-500">
                  Clients with high/urgent workload
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-slate-600"
              >
                View all <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            <div className="space-y-4">
              {(dashboardData?.highPrioritySummary ?? []).length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                  <p className="text-sm text-slate-600">
                    No high priority tasks pending
                  </p>
                  <p className="text-xs text-slate-500">
                    Great job staying on top of your work!
                  </p>
                </div>
              ) : (
                (dashboardData?.highPrioritySummary ?? []).map((item) => {
                  const hasUrgent = item.urgent > 0;
                  return (
                    <div
                      key={item.clientId}
                      className="flex items-center justify-between p-3 rounded-lg transition-all duration-200 hover:bg-slate-100/50"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-10 w-10 rounded-full flex items-center justify-center shadow-sm ${
                            hasUrgent
                              ? "bg-red-100 text-red-600"
                              : "bg-orange-100 text-orange-600"
                          }`}
                        >
                          {hasUrgent ? (
                            <AlertCircle className="h-5 w-5" />
                          ) : (
                            <Clock className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">
                            {item.clientName}
                          </p>
                          <p className="text-xs text-slate-500">
                            High: {item.high} • Urgent: {item.urgent}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          hasUrgent
                            ? "bg-red-50 text-red-700 border-red-200 font-medium"
                            : "bg-orange-50 text-orange-700 border-orange-200 font-medium"
                        }
                      >
                        {hasUrgent ? "NEEDS ACTION" : "HIGH PRIORITY"}
                      </Badge>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// --------- Small subcomponents ----------
function MetricCard({
  title,
  value,
  change,
  trend,
  description,
  icon,
  loading = false,
  gradient = "from-blue-500 to-cyan-500",
}: {
  title: string;
  value: string;
  change: string;
  trend: "up" | "down";
  description: string;
  icon: React.ReactNode;
  loading?: boolean;
  gradient?: string;
}) {
  if (loading) {
    return (
      <Card className="overflow-hidden transition-all duration-300 hover:shadow-lg border-0 rounded-2xl bg-gradient-to-br from-white to-slate-50/50">
        <CardContent className="p-6">
          <Skeleton className="h-12 w-12 rounded-xl mb-4" />
          <Skeleton className="h-8 w-20 mb-2" />
          <Skeleton className="h-4 w-32 mb-4" />
          <Skeleton className="h-3 w-40" />
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden transition-all duration-300 hover:shadow-xl border-0 rounded-2xl bg-gradient-to-br from-white to-slate-50/50 backdrop-blur-sm group">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div
            className={`p-3 rounded-xl bg-gradient-to-r ${gradient} text-white shadow-md`}
          >
            {icon}
          </div>
          <Badge
            variant="outline"
            className={
              trend === "up"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 font-medium group-hover:shadow-sm"
                : "bg-red-50 text-red-700 border-red-200 font-medium group-hover:shadow-sm"
            }
          >
            {change}{" "}
            {trend === "up" ? <MoveUp className="h-3.5 w-3.5 ml-1" /> : null}
          </Badge>
        </div>
        <div className="mt-5">
          <h3 className="text-3xl font-bold text-slate-900">{value}</h3>
          <p className="text-sm text-slate-600 mt-1 font-medium">{title}</p>
        </div>
        <p className="text-xs text-slate-500 mt-4">{description}</p>
      </CardContent>
    </Card>
  );
}

function BarRow({
  label,
  value,
  total,
  barClass,
}: {
  label: string;
  value: number;
  total: number;
  barClass:
    | "bg-emerald-500"
    | "bg-blue-500"
    | "bg-amber-500"
    | "bg-red-500"
    | "bg-indigo-500"; // NEW
}) {
  // Tailwind JIT-safe inner color class
  let innerColorClass = "";
  switch (barClass) {
    case "bg-emerald-500":
      innerColorClass = "[&>div]:bg-emerald-500";
      break;
    case "bg-blue-500":
      innerColorClass = "[&>div]:bg-blue-500";
      break;
    case "bg-amber-500":
      innerColorClass = "[&>div]:bg-amber-500";
      break;
    case "bg-red-500":
      innerColorClass = "[&>div]:bg-red-500";
      break;
    case "bg-indigo-500":
      innerColorClass = "[&>div]:bg-indigo-500";
      break;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${barClass}`}></div>
          <span className="text-sm font-medium text-slate-700">{label}</span>
        </div>
        <span className="text-sm font-medium text-slate-900">
          {value} {total ? ` / ${total}` : ""}
        </span>
      </div>
      <Progress
        value={total ? (value / total) * 100 : 0}
        className={`h-2.5 bg-slate-200 ${innerColorClass} [&>div]:rounded-full`}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 p-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center w-full md:w-auto">
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-36" />
          </div>
          <Skeleton className="h-9 w-40" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((i) => (
          <Card
            key={i}
            className="overflow-hidden transition-all duration-300 hover:shadow-lg border-0 rounded-2xl bg-gradient-to-br from-white to-slate-50/50"
          >
            <CardContent className="p-6">
              <Skeleton className="h-12 w-12 rounded-xl mb-4" />
              <Skeleton className="h-8 w-20 mb-2" />
              <Skeleton className="h-4 w-32 mb-4" />
              <Skeleton className="h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-200/70 py-5">
            <Skeleton className="h-5 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-2.5 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-200/70 py-5">
            <Skeleton className="h-5 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-2.5 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-200/70 py-5">
            <Skeleton className="h-5 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="p-5">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div>
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-200/70 py-5">
            <Skeleton className="h-5 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="p-5">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div>
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
