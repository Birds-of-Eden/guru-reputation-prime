//app/com
"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  lazy,
  Suspense,
  useDeferredValue,
} from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  CheckCircle2,
  Search,
  Calendar,
  BarChart3,
  AlertCircle,
  LinkIcon,
  PenTool,
  Star,
  Rss,
  ClipboardPlus,
  CircleCheckBig,
} from "lucide-react";
import "react-datepicker/dist/react-datepicker.css";
import { useUserSession } from "@/lib/hooks/use-user-session";
import { useRouter } from "next/navigation";
import { useRoleSegment } from "@/lib/hooks/use-role-segment";
import useSWR from "swr";
import CreateTasksAuto from "./CreateTasksAuto";
import CreateNextTasksAuto from "./CreateNextTasksAuto";
import { RenewPostingTasksButton } from "./DateEntryRenew";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import CreateTasksManualButton from "./CreateTasksButtonManual";

// Lazy load modal components
const LazyContentWritingModal = lazy(
  () => import("./DataEntryContentWritingDialog")
);
const LazyReviewRemovalModal = lazy(
  () => import("./DataEmtryReviewRemovalDialog")
);
const LazyBacklinkingModal = lazy(() => import("./DataEntryBacklinkingDialog"));
const LazySummaryReportModal = lazy(
  () => import("./DataEntrySummaryReportDialog")
);
const LazyCompletionDialog = lazy(() => import("./DataEntryCompletionDialog"));
const LazyMonitoringDialog = lazy(() => import("./DataEntryMonitoringTask"));

// ----------------------
// Types & Constants
// ----------------------

export type DETask = {
  id: string;
  name: string;
  status: string;
  priority: string;
  completionLink?: string | null;
  email?: string | null;
  username?: string | null;
  password?: string | null;
  category?: { id: string; name: string } | null;
  assignedTo?: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
  dueDate?: string | null;
  completedAt?: string | null;
  idealDurationMinutes?: number | null;
  // Persisted JSON: { completedByUserId, completedByName, completedAt, status }
  dataEntryReport?: any;
  // Persisted JSON: Content writing data with titles and content sections
  contentWriting?: any;
};

// Status badge variant mapping
const statusVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  in_progress: "secondary",
  completed: "default",
  qc_approved: "default",
  rejected: "destructive",
};

// Priority color mapping
const priorityColor: Record<string, string> = {
  high: "text-red-600",
  medium: "text-yellow-600",
  low: "text-green-600",
};

// Helper category checks (pure functions, stable references)
const SIMPLE_CATEGORIES = [
  "Social Activity",
  "Blog Posting",
  "Image Optimization",
  "Content Studio",
];

const CONTENT_WRITING_CATEGORIES = ["Content Writing", "Guest Posting"];

export function isSimpleTask(task: DETask | null): boolean {
  if (!task?.category?.name) return false;
  return SIMPLE_CATEGORIES.includes(task.category.name);
}

export function isContentWritingTask(task: DETask | null): boolean {
  if (!task?.category?.name) return false;
  return CONTENT_WRITING_CATEGORIES.some((cat) =>
    task.category?.name?.toLowerCase().includes(cat.toLowerCase())
  );
}

export function isReviewRemovalTask(task: DETask | null): boolean {
  if (!task?.category) return false;
  const nameLc = (task.category.name || "").toLowerCase();
  const idLc = (task.category.id || "").toLowerCase();
  return (
    nameLc.includes("review removal") ||
    nameLc === "review_removal" ||
    idLc.includes("review_removal")
  );
}

export function isBacklinkingTask(task: DETask | null): boolean {
  if (!task?.category) return false;
  const nameLc = (task.category.name || "").toLowerCase();
  const idLc = (task.category.id || "").toLowerCase();
  return nameLc.includes("backlinks") || idLc.includes("backlinks");
}

export function isSummaryReportTask(task: DETask | null): boolean {
  if (!task?.category) return false;
  const nameLc = (task.category.name || "").toLowerCase();
  const idLc = (task.category.id || "").toLowerCase();
  return (
    nameLc.includes("summary report") ||
    nameLc === "summary_report" ||
    idLc.includes("summary_report")
  );
}

export function isMonitoringTask(task: DETask | null): boolean {
  if (!task?.category) return false;
  const nameLc = (task.category.name || "").toLowerCase();
  const idLc = (task.category.id || "").toLowerCase();
  return nameLc.includes("monitoring") || idLc.includes("monitoring");
}

// Function to extract username from URL
export function extractUsernameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname
      .split("/")
      .filter((segment) => segment.length > 0);

    for (let i = 0; i < pathSegments.length; i++) {
      const segment = pathSegments[i];
      if (
        [
          "user",
          "profile",
          "account",
          "users",
          "profiles",
          "accounts",
          "dashboard",
          "settings",
          "admin",
          "api",
          "auth",
          "login",
          "signup",
          "register",
        ].includes(segment.toLowerCase())
      ) {
        if (i + 1 < pathSegments.length) {
          const nextSegment = pathSegments[i + 1];
          if (/^[a-zA-Z0-9._-]{3,30}$/.test(nextSegment)) {
            return nextSegment;
          }
        }
      }
      if (/^[a-zA-Z0-9._-]{3,30}$/.test(segment)) {
        return segment;
      }
    }

    const searchParams = urlObj.searchParams;
    if (
      searchParams.has("user") ||
      searchParams.has("username") ||
      searchParams.has("profile") ||
      searchParams.has("u")
    ) {
      return (
        searchParams.get("user") ||
        searchParams.get("username") ||
        searchParams.get("profile") ||
        searchParams.get("u") ||
        ""
      );
    }

    const fragment = urlObj.hash.substring(1);
    if (fragment && /^[a-zA-Z0-9._-]{3,30}$/.test(fragment)) {
      return fragment;
    }

    return "";
  } catch {
    return "";
  }
}

// ----------------------
// SWR Hooks
// ----------------------

const useTasksData = (clientId: string, userId?: string) => {
  const shouldFetch = Boolean(clientId && userId);

  const {
    data: tasksData,
    error,
    isLoading,
    mutate,
  } = useSWR(
    shouldFetch ? `/api/tasks/client/${clientId}` : null,
    async (url: string) => {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to fetch tasks");
      const data = await response.json();
      // Keep logic identical: filter by assignedTo === userId
      return (data as any[]).filter(
        (t) => t?.assignedTo?.id && userId && t.assignedTo.id === userId
      );
    },
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      dedupingInterval: 3000,
    }
  );

  return {
    tasks: tasksData || [],
    loading: isLoading || !shouldFetch,
    error,
    refetch: mutate,
  };
};

const useAgentsData = () => {
  const {
    data: agentsData,
    error,
    isLoading,
  } = useSWR(
    "/api/users?role=agent&limit=200",
    async (url: string) => {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to fetch agents");
      const data = await response.json();
      return (data?.users ?? data?.data ?? [])
        .filter((u: any) => u?.role?.name?.toLowerCase() === "agent")
        .map((u: any) => ({
          id: u.id,
          name: u.name ?? null,
          email: u.email ?? null,
        }));
    },
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  return { agents: agentsData || [], loading: isLoading, error };
};

const useClientData = (clientId: string) => {
  const {
    data: clientData,
    error,
    isLoading,
  } = useSWR(
    clientId ? `/api/clients/${clientId}` : null,
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch client");
      return response.json();
    },
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  );

  const clientName = clientData?.name || `Client ${clientId}`;
  const clientEmail = clientData?.email || "";
  const packageMonths = Number(clientData?.package?.totalMonths) || 1;
  const isDueOver = clientData?.dueDate
    ? new Date(clientData.dueDate) < new Date()
    : false;

  return {
    client: clientData,
    loading: isLoading,
    error,
    clientName,
    clientEmail,
    packageMonths,
    isDueOver,
  };
};

const useStatsData = (clientId: string, userId?: string) => {
  const shouldFetch = Boolean(clientId && userId);

  const {
    data: statsData,
    error,
    isLoading,
  } = useSWR(
    shouldFetch
      ? `/api/tasks/data-entry-reports?clientId=${clientId}&pageSize=1000`
      : null,
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch stats");
      const data = await response.json();
      const reports = Array.isArray(data?.data) ? data.data : [];

      const today = new Date();
      const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(
        today.getTime() - 30 * 24 * 60 * 60 * 1000
      );

      const completedByMe = reports.reduce((acc: number, t: any) => {
        const rid = t?.dataEntryReport?.completedByUserId;
        return acc + (userId && rid === userId ? 1 : 0);
      }, 0);

      const last7Days = reports.filter(
        (t: any) =>
          t.dataEntryCompletedAt &&
          new Date(t.dataEntryCompletedAt) >= sevenDaysAgo
      ).length;

      const last30Days = reports.filter(
        (t: any) =>
          t.dataEntryCompletedAt &&
          new Date(t.dataEntryCompletedAt) >= thirtyDaysAgo
      ).length;

      return {
        dataEntryCompleted: completedByMe,
        last7Days,
        last30Days,
      };
    },
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  return { stats: statsData, loading: isLoading || !shouldFetch, error };
};

interface TaskStats {
  total: number;
  completed: number;
  pending: number;
  inProgress: number;
  overdue: number;
  dataEntryCompleted: number;
  last7Days: number;
  last30Days: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
}

// ----------------------
// Memoized Task Row
// ----------------------

interface TaskRowProps {
  data: {
    task: DETask;
    dueDateFormatted: string | null;
    isOverdue: boolean;
  };
  openContentWritingModal: (task: DETask) => void;
  openReviewRemovalModal: (task: DETask) => void;
  openBacklinkingModal: (task: DETask) => void;
  openSummaryReportModal: (task: DETask) => void;
  openMonitoringModal: (task: DETask) => void;
  openComplete: (task: DETask) => void;
}

const TaskRow: React.FC<TaskRowProps> = React.memo(
  ({
    data,
    openContentWritingModal,
    openReviewRemovalModal,
    openBacklinkingModal,
    openSummaryReportModal,
    openMonitoringModal,
    openComplete,
  }) => {
    const { task: t, dueDateFormatted, isOverdue } = data;

    return (
      <tr
        key={t.id}
        className="group hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 transition-all duration-300 ease-in-out"
      >
        <td className="px-6 py-5">
          <div
            className="font-bold text-slate-800 truncate max-w-[250px] group-hover:text-indigo-700 transition-colors"
            title={t.name}
          >
            {t.name}
          </div>
        </td>
        <td className="px-6 py-5">
          <Badge
            variant="outline"
            className="bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border-blue-300 font-semibold px-3 py-1 rounded-full shadow-sm"
          >
            {t.category?.name || "—"}
          </Badge>
        </td>
        <td className="px-6 py-5">
          <span
            className={`font-bold text-sm uppercase tracking-wide ${
              priorityColor[t.priority] || "text-gray-600"
            }`}
          >
            {t.priority
              ? t.priority.charAt(0).toUpperCase() + t.priority.slice(1)
              : "—"}
          </span>
        </td>
        <td className="px-6 py-5">
          <Badge
            variant={statusVariant[t.status] || "outline"}
            className="capitalize font-semibold px-3 py-1 rounded-full shadow-sm"
          >
            {t.status.replaceAll("_", " ")}
          </Badge>
        </td>
        <td className="px-6 py-5">
          <div
            className={`flex items-center gap-2 font-medium ${
              isOverdue ? "text-red-600 font-bold" : "text-slate-600"
            }`}
          >
            {dueDateFormatted ? (
              <>
                <Calendar className="h-4 w-4" />
                {dueDateFormatted}
                {isOverdue && (
                  <AlertCircle className="h-4 w-4 ml-1 animate-pulse" />
                )}
              </>
            ) : (
              "—"
            )}
          </div>
        </td>
        <td className="px-6 py-5 text-right">
          <div className="flex gap-3 justify-end">
            {isContentWritingTask(t) ? (
              <Button
                className="bg-gradient-to-r from-purple-600 via-violet-600 to-blue-600 hover:shadow-xl hover:scale-105 transition-all duration-300 shadow-lg font-semibold"
                onClick={() => openContentWritingModal(t)}
                size="sm"
                disabled={
                  t.status === "completed" || t.status === "qc_approved"
                }
              >
                <PenTool className="h-4 w-4 mr-2" />
                {t.category?.name || "Content Writing"}
              </Button>
            ) : isReviewRemovalTask(t) ? (
              <Button
                className="bg-gradient-to-r from-red-500 via-pink-500 to-orange-500 hover:shadow-xl hover:scale-105 transition-all duration-300 shadow-lg font-semibold"
                onClick={() => openReviewRemovalModal(t)}
                size="sm"
                disabled={
                  t.status === "completed" || t.status === "qc_approved"
                }
              >
                <Star className="h-4 w-4 mr-2" />
                Review Removal
              </Button>
            ) : isBacklinkingTask(t) ? (
              <Button
                className="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 hover:shadow-xl hover:scale-105 transition-all duration-300 shadow-lg font-semibold"
                onClick={() => openBacklinkingModal(t)}
                size="sm"
                disabled={
                  t.status === "completed" || t.status === "qc_approved"
                }
              >
                <LinkIcon className="h-4 w-4 mr-2" />
                Backlinking
              </Button>
            ) : isSummaryReportTask(t) ? (
              <Button
                className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 hover:shadow-xl hover:scale-105 transition-all duration-300 shadow-lg font-semibold"
                onClick={() => openSummaryReportModal(t)}
                size="sm"
                disabled={
                  t.status === "completed" || t.status === "qc_approved"
                }
              >
                <ClipboardPlus className="h-4 w-4 mr-2" />
                Summary Report
              </Button>
            ) : isMonitoringTask(t) ? (
              <Button
                className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 hover:shadow-xl hover:scale-105 transition-all duration-300 shadow-lg font-semibold"
                onClick={() => openMonitoringModal(t)}
                size="sm"
                disabled={
                  t.status === "completed" || t.status === "qc_approved"
                }
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Monitoring
              </Button>
            ) : (
              <Button
                className="bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 hover:shadow-xl hover:scale-105 transition-all duration-300 shadow-lg font-semibold"
                onClick={() => openComplete(t)}
                size="sm"
                disabled={
                  t.status === "completed" || t.status === "qc_approved"
                }
              >
                <CircleCheckBig className="h-4 w-4 mr-2" />
                {t.status === "completed" || t.status === "qc_approved"
                  ? "Completed"
                  : "Complete"}
              </Button>
            )}
          </div>
        </td>
      </tr>
    );
  }
);

TaskRow.displayName = "TaskRow";

// ----------------------
// Main Component
// ----------------------

export default function DataEntryCompleteTasksPanel({
  clientId,
}: {
  clientId: string;
}) {
  const router = useRouter();
  const roleSegment = useRoleSegment();
  const distributionBasePath = `/${roleSegment}/distribution/client-agent`;
  const { user } = useUserSession();

  // Use SWR hooks for data fetching
  const {
    tasks,
    loading: tasksLoading,
    refetch: refetchTasks,
  } = useTasksData(clientId, user?.id);
  const { agents, loading: agentsLoading } = useAgentsData();
  const {
    clientName,
    clientEmail,
    packageMonths,
    isDueOver,
    loading: clientLoading,
  } = useClientData(clientId);
  const { stats: statsData, loading: statsLoading } = useStatsData(
    clientId,
    user?.id
  );

  // Combined loading state
  const loading =
    tasksLoading || agentsLoading || clientLoading || statsLoading;

  // Debounced search state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const deferredSearch = useDeferredValue(debouncedSearch);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  // Modal states
  const [selected, setSelected] = useState<DETask | null>(null);
  const [link, setLink] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [lastUsedPassword, setLastUsedPassword] = useState<string | null>(null);
  const [doneBy, setDoneBy] = useState<string>("");
  const [completedAt, setCompletedAt] = useState<Date | undefined>(undefined);
  const [lastUsedDate, setLastUsedDate] = useState<Date | null>(null);
  const [lastUsedAgent, setLastUsedAgent] = useState<string | null>(null);
  const [agentSearchTerm, setAgentSearchTerm] = useState("");
  const [createTasksChoiceOpen, setCreateTasksChoiceOpen] = useState(false);
  const [createNextChoiceOpen, setCreateNextChoiceOpen] = useState(false);

  // Content Writing Modal state
  const [contentWritingModalOpen, setContentWritingModalOpen] = useState(false);
  const [selectedContentTask, setSelectedContentTask] = useState<DETask | null>(
    null
  );

  // Review Removal Modal state
  const [reviewRemovalModalOpen, setReviewRemovalModalOpen] = useState(false);
  const [selectedReviewRemovalTask, setSelectedReviewRemovalTask] =
    useState<DETask | null>(null);

  // Backlinking Modal state
  const [backlinkingModalOpen, setBacklinkingModalOpen] = useState(false);
  const [selectedBacklinkingTask, setSelectedBacklinkingTask] =
    useState<DETask | null>(null);

  // Summary Report Modal state
  const [summaryReportModalOpen, setSummaryReportModalOpen] = useState(false);
  const [selectedSummaryReportTask, setSelectedSummaryReportTask] =
    useState<DETask | null>(null);

  // Monitoring modal state
  const [monitoringModalOpen, setMonitoringModalOpen] = useState(false);
  const [selectedMonitoringTask, setSelectedMonitoringTask] =
    useState<DETask | null>(null);

  // Button states from localStorage
  const [showCreateTasksButton, setShowCreateTasksButton] = useState(true);
  const [showRenewButton, setShowRenewButton] = useState(false);
  const [showCreateNextButton, setShowCreateNextButton] = useState(false);
  const [hasCreatedTasks, setHasCreatedTasks] = useState(false);

  const [creatingPosting, setCreatingPosting] = useState(false);

  // Task stats calculation
  const taskStats: TaskStats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(
      (t) => t.status === "completed" || t.status === "qc_approved"
    ).length;
    const pending = tasks.filter((t) => t.status === "pending").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const overdue = tasks.filter((t) => {
      if (!t.dueDate) return false;
      return (
        new Date(t.dueDate) < new Date() &&
        (t.status === "pending" || t.status === "in_progress")
      );
    }).length;

    return {
      total,
      completed,
      pending,
      inProgress,
      overdue,
      dataEntryCompleted: statsData?.dataEntryCompleted || 0,
      last7Days: statsData?.last7Days || 0,
      last30Days: statsData?.last30Days || 0,
      byStatus: {},
      byPriority: {},
    };
  }, [tasks, statsData]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Pre-indexed filtering using deferred search
  const filteredTasks = useMemo(() => {
    let result = tasks;

    if (deferredSearch.trim()) {
      const query = deferredSearch.toLowerCase().trim();
      result = result.filter((t) =>
        [t.name, t.category?.name || "", t.priority || "", t.status || ""].some(
          (s) => String(s).toLowerCase().includes(query)
        )
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((t) => t.status === statusFilter);
    }

    if (priorityFilter !== "all") {
      result = result.filter((t) => t.priority === priorityFilter);
    }

    return result;
  }, [tasks, deferredSearch, statusFilter, priorityFilter]);

  // Simple client-side pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredTasks.length / pageSize));
  }, [filteredTasks.length, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const paginatedTasks = useMemo(() => {
    const start = (page - 1) * pageSize;
    const slice = filteredTasks.slice(start, start + pageSize);

    const now = Date.now();
    return slice.map((t) => {
      const dueDateObj = t.dueDate ? new Date(t.dueDate) : null;
      const dueDateFormatted =
        dueDateObj && !isNaN(dueDateObj.getTime())
          ? format(dueDateObj, "MMM dd, yyyy")
          : null;
      const isOverdue = !!(
        dueDateObj &&
        dueDateObj.getTime() < now &&
        (t.status === "pending" || t.status === "in_progress")
      );
      return { task: t, dueDateFormatted, isOverdue };
    });
  }, [filteredTasks, page, pageSize]);

  // Check if posting tasks already exist
  const hasPostingTasks = useMemo(
    () =>
      tasks.some(
        (task: any) =>
          task.name?.toLowerCase().includes("posting") ||
          task.category?.name?.toLowerCase().includes("posting")
      ),
    [tasks]
  );

  // Gate readiness by required categories fully QC-approved
  const requiredCategories = useMemo(
    () => ["Social Assets Creation", "Web2 Creation", "Additional Assets Creation"],
    []
  );

  const isReadyForPostingCreation = useMemo(() => {
    if (!tasks || tasks.length === 0) return false;
    return requiredCategories.every((cat) => {
      const inCat = tasks.filter(
        (t) => (t.category?.name || "").toLowerCase() === cat.toLowerCase()
      );
      if (inCat.length === 0) return false;
      return inCat.every((t) => t.status === "qc_approved");
    });
  }, [tasks, requiredCategories]);

  // Count tasks completed by the current Data Entry user
  const dataEntryCompletedCount = useMemo(() => {
    if (!user?.id) return 0;
    return tasks.reduce((count, task: any) => {
      const report = task?.dataEntryReport;
      if (!report) return count;
      const isCompletedByMe =
        report.completedByUserId === user.id &&
        typeof report.status === "string" &&
        report.status.trim().toLowerCase() === "completed by data entry";
      return isCompletedByMe ? count + 1 : count;
    }, 0);
  }, [tasks, user?.id]);

  // Optimized callback functions
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const handleStatusFilterChange = useCallback((value: string) => {
    setStatusFilter(value);
  }, []);

  const handlePriorityFilterChange = useCallback((value: string) => {
    setPriorityFilter(value);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchQuery("");
    setStatusFilter("all");
    setPriorityFilter("all");
  }, []);

  const handleCreateTasksChoiceOpen = useCallback(() => {
    setCreateTasksChoiceOpen(true);
  }, []);

  const handleCreateTasksChoiceClose = useCallback(() => {
    setCreateTasksChoiceOpen(false);
  }, []);

  const handleTaskCreationComplete = useCallback(() => {
    setHasCreatedTasks(true);
    setCreateTasksChoiceOpen(false);
    setShowCreateTasksButton(false);
    setShowRenewButton(true);
    refetchTasks();
  }, [refetchTasks]);

  const handleRenewComplete = useCallback(() => {
    setShowRenewButton(false);
    setShowCreateNextButton(true);
  }, []);

  const handleCreateNextComplete = useCallback(() => {
    setShowCreateNextButton(false);
  }, []);

  const resetModal = useCallback(() => {
    setSelected(null);
    setLink("");
    setEmail("");
    setUsername("");
    setDoneBy("");
    setCompletedAt(undefined);
  }, []);

  const openComplete = useCallback(
    (t: DETask) => {
      setSelected(t);
      setLink(t.completionLink || "");
      setEmail(clientEmail || "");
      setUsername("");
      setPassword(password);

      if (t.completedAt) {
        const d = new Date(t.completedAt);
        if (!isNaN(d.getTime())) {
          setCompletedAt(d);
          setLastUsedDate(d);
        } else if (lastUsedDate) {
          setCompletedAt(lastUsedDate);
        } else {
          setCompletedAt(new Date());
        }
      } else if (lastUsedDate) {
        setCompletedAt(lastUsedDate);
      } else {
        setCompletedAt(new Date());
      }

      if (lastUsedAgent) {
        setDoneBy(lastUsedAgent);
      }
    },
    [clientEmail, password, lastUsedDate, lastUsedAgent]
  );

  const submit = useCallback(async () => {
    if (!user?.id || !selected) return;
    if (!link.trim()) {
      toast.error("Completion link is required");
      return;
    }
    if (!completedAt) {
      toast.error("Please select a completion date");
      return;
    }
    if (completedAt.getTime() > Date.now()) {
      toast.error("Completed date cannot be in the future");
      return;
    }
    if (!doneBy) {
      toast.error("Please select an agent (Done by)");
      return;
    }

    if (doneBy) {
      setLastUsedAgent(doneBy);
    }

    try {
      const r1 = await fetch(`/api/tasks/agents/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: selected.id,
          status: "completed",
          actualDurationMinutes: selected.idealDurationMinutes ?? undefined,
          completionLink: link.trim(),
          username: username.trim() || undefined,
          email: email.trim() || undefined,
          password: password || undefined,
        }),
      });
      const j1 = await r1.json();
      if (!r1.ok)
        throw new Error(j1?.message || j1?.error || "Failed to complete task");

      const r2 = await fetch(`/api/tasks/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "completed",
          completedAt: completedAt.toISOString(),
          actualDurationMinutes: selected.idealDurationMinutes ?? undefined,
          dataEntryReport: {
            completedByUserId: user.id,
            completedByName:
              (user as any)?.name || (user as any)?.email || user.id,
            completedBy: new Date().toISOString(),
            status: "Completed by " + (user as any)?.name,
          },
        }),
      });
      const j2 = await r2.json();
      if (!r2.ok) throw new Error(j2?.error || "Failed to set completed date");

      if (doneBy && clientId) {
        const distBody = {
          clientId,
          assignments: [
            {
              taskId: selected.id,
              agentId: doneBy,
              note: "Reassigned to actual performer by data_entry",
              dueDate: selected.dueDate,
            },
          ],
        } as any;
        const rDist = await fetch(`/api/tasks/distribute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(distBody),
        });
        const jDist = await rDist.json();
        if (!rDist.ok)
          throw new Error(
            jDist?.error || "Failed to reassign task to selected agent"
          );
      }

      const r3 = await fetch(`/api/tasks/${selected.id}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          performanceRating: "Good",
          notes: doneBy ? `Done by agent: ${doneBy}` : undefined,
        }),
      });
      const j3 = await r3.json();
      if (!r3.ok) throw new Error(j3?.error || "Failed to approve task");

      toast.success("Task completed and QC approved");
      resetModal();
      refetchTasks();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to submit");
    }
  }, [
    user?.id,
    selected,
    link,
    completedAt,
    doneBy,
    clientId,
    username,
    email,
    password,
    resetModal,
    refetchTasks,
  ]);

  const createPostingTasks = useCallback(async () => {
    if (!clientId) return;
    if (!isReadyForPostingCreation) {
      toast.warning("Please complete & QC-approve all tasks first.");
      return;
    }
    router.push(`${distributionBasePath}/client/${clientId}`);
  }, [clientId, isReadyForPostingCreation, router, distributionBasePath]);

  // Modal handlers
  const openContentWritingModal = useCallback((task: DETask) => {
    setSelectedContentTask(task);
    setContentWritingModalOpen(true);
  }, []);

  const closeContentWritingModal = useCallback(() => {
    setContentWritingModalOpen(false);
    setSelectedContentTask(null);
  }, []);

  const openReviewRemovalModal = useCallback((task: DETask) => {
    setSelectedReviewRemovalTask(task);
    setReviewRemovalModalOpen(true);
  }, []);

  const closeReviewRemovalModal = useCallback(() => {
    setReviewRemovalModalOpen(false);
    setSelectedReviewRemovalTask(null);
  }, []);

  const openBacklinkingModal = useCallback((task: DETask) => {
    setSelectedBacklinkingTask(task);
    setBacklinkingModalOpen(true);
  }, []);

  const closeBacklinkingModal = useCallback(() => {
    setBacklinkingModalOpen(false);
    setSelectedBacklinkingTask(null);
  }, []);

  const openSummaryReportModal = useCallback((task: DETask) => {
    setSelectedSummaryReportTask(task);
    setSummaryReportModalOpen(true);
  }, []);

  const closeSummaryReportModal = useCallback(() => {
    setSummaryReportModalOpen(false);
    setSelectedSummaryReportTask(null);
  }, []);

  const openMonitoringModal = useCallback((task: DETask) => {
    setSelectedMonitoringTask(task);
    setMonitoringModalOpen(true);
  }, []);

  const closeMonitoringModal = useCallback(() => {
    setMonitoringModalOpen(false);
    setSelectedMonitoringTask(null);
  }, []);

  // Check button states from localStorage on mount
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && clientId) {
        const createTasksKey = `createTasksClicked_${clientId}`;
        const renewKey = `renewClicked_${clientId}`;
        const createNextKey = `createNextClicked_${clientId}`;

        const createTasksClicked =
          localStorage.getItem(createTasksKey) === "true";
        const renewClicked = localStorage.getItem(renewKey) === "true";
        const createNextClicked =
          localStorage.getItem(createNextKey) === "true";

        setShowCreateTasksButton(!createTasksClicked);
        setShowRenewButton(createTasksClicked && !renewClicked);
        setShowCreateNextButton(renewClicked && !createNextClicked);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [clientId]);

  // Save password to localStorage when it changes
  useEffect(() => {
    if (password) {
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem("lastUsedPassword", password);
          setLastUsedPassword(password);
        }
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [password]);

  // Auto-fill username from URL when link changes
  useEffect(() => {
    if (link && link.trim()) {
      const extractedUsername = extractUsernameFromUrl(link.trim());
      if (extractedUsername && !username) {
        setUsername(extractedUsername);
      }
    }
  }, [link, username]);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && clientId) {
        const key = `lastUsedAgent_${clientId}`;
        const saved = localStorage.getItem(key);
        if (saved) {
          setLastUsedAgent(saved);
        }
      }
    } catch {}
  }, [clientId]);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && clientId && lastUsedAgent) {
        const key = `lastUsedAgent_${clientId}`;
        localStorage.setItem(key, lastUsedAgent);
      }
    } catch {}
  }, [clientId, lastUsedAgent]);

  // Load last used password from localStorage on mount
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const savedPassword = localStorage.getItem("lastUsedPassword");
        if (savedPassword) {
          setLastUsedPassword(savedPassword);
          setPassword(savedPassword);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Statistics Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        {/* Total Tasks Card */}
        <Card className="group relative overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-purple-700 hover:shadow-indigo-500/50 transition-all duration-500 hover:scale-105">
          <div className="absolute inset-0 bg-white/10 backdrop-blur-sm" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-3 pt-6">
            <CardTitle className="text-sm font-semibold tracking-wide text-white/90 uppercase">
              Tasks Remaining
            </CardTitle>
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-md">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-5xl font-black text-white mb-2 tracking-tight">
              {taskStats.total}
            </div>
            <p className="text-sm text-white/80 font-medium">Assigned to you</p>
            <div className="absolute bottom-0 right-0 opacity-10">
              <BarChart3 className="h-32 w-32 text-white" />
            </div>
          </CardContent>
        </Card>

        {/* Completed Tasks Card */}
        <Card className="group relative overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-emerald-500 via-green-600 to-teal-700 hover:shadow-emerald-500/50 transition-all duration-500 hover:scale-105">
          <div className="absolute inset-0 bg-white/10 backdrop-blur-sm" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-3 pt-6">
            <CardTitle className="text-sm font-semibold tracking-wide text-white/90 uppercase">
              Completed
            </CardTitle>
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-md">
              <CheckCircle2 className="h-6 w-6 text-white" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-5xl font-black text-white mb-2 tracking-tight">
              {taskStats.dataEntryCompleted}
            </div>
            <p className="text-sm text-white/80 font-medium">
              Completed by you
            </p>
            <div className="absolute bottom-0 right-0 opacity-10">
              <CheckCircle2 className="h-32 w-32 text-white" />
            </div>
          </CardContent>
        </Card>

        {/* Overdue Tasks Card */}
        <Card className="group relative overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-orange-500 via-amber-600 to-red-600 hover:shadow-orange-500/50 transition-all duration-500 hover:scale-105">
          <div className="absolute inset-0 bg-white/10 backdrop-blur-sm" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-3 pt-6">
            <CardTitle className="text-sm font-semibold tracking-wide text-white/90 uppercase">
              Overdue
            </CardTitle>
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-md">
              <AlertCircle className="h-6 w-6 text-white" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-5xl font-black text-white mb-2 tracking-tight">
              {taskStats.overdue}
            </div>
            <p className="text-sm text-white/80 font-medium">
              {taskStats.last7Days} last 7d • {taskStats.last30Days} last 30d
            </p>
            <div className="absolute bottom-0 right-0 opacity-10">
              <AlertCircle className="h-32 w-32 text-white" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tasks Panel */}
      <Card className="border-0 shadow-2xl overflow-hidden backdrop-blur-xl bg-white/95">
        <CardHeader className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white py-8 px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-md">
                <BarChart3 className="h-8 w-8 text-white" />
              </div>
              <div>
                <CardTitle className="text-3xl font-black tracking-tight">
                  {clientId
                    ? clientName
                      ? `${clientName}`
                      : `Client ${clientId}`
                    : "All Clients"}
                </CardTitle>
                <p className="text-white/80 text-sm font-medium mt-1">
                  Complete Tasks Dashboard
                </p>
              </div>
            </div>
            <>
              <div className="grid grid-cols-3 gap-4">
                {showCreateTasksButton && (
                  <Button
                    onClick={handleCreateTasksChoiceOpen}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    Create Posting Tasks
                  </Button>
                )}

                {isDueOver && (
                  <RenewPostingTasksButton
                    clientId={clientId}
                    templateId={undefined}
                    packageMonths={packageMonths}
                    onRenewComplete={handleRenewComplete}
                  />
                )}

                <CreateNextTasksAuto
                  clientId={clientId}
                  assigneeId={lastUsedAgent || undefined}
                  onComplete={handleCreateNextComplete}
                />
              </div>
              <Dialog
                open={createTasksChoiceOpen}
                onOpenChange={handleCreateTasksChoiceClose}
              >
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Choose generation mode</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4">
                    <div className="rounded-lg border p-4">
                      <div className="font-semibold mb-2">Auto</div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Automatically generate posting tasks from assets and
                        auto-assign to a data_entry user.
                      </p>
                      <CreateTasksAuto
                        clientId={clientId}
                        onTaskCreationComplete={handleTaskCreationComplete}
                      />
                    </div>
                    <div className="rounded-lg border p-4">
                      <div className="font-semibold mb-2">Manual</div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Pick counts per asset type and generate. Tasks will
                        auto-assign to you.
                      </p>
                      <CreateTasksManualButton
                        clientId={clientId}
                        onTaskCreationComplete={() => {
                          setHasCreatedTasks(true);
                          setCreateTasksChoiceOpen(false);
                          refetchTasks();
                        }}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setCreateTasksChoiceOpen(false)}
                    >
                      Close
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          </div>
        </CardHeader>

        <CardContent className="p-8">
          {/* Filters and Search */}
          <div className="flex flex-col md:flex-row gap-6 mb-8">
            <div className="relative flex-1">
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-indigo-500">
                <Search className="h-5 w-5" />
              </div>
              <Input
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search tasks by name, category, priority..."
                className="pl-12 h-14 rounded-2xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 text-base font-medium shadow-sm transition-all"
              />
            </div>
          </div>

          {/* Tasks Table */}
          <div className="border-2 border-slate-200 rounded-3xl overflow-hidden shadow-lg bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200">
                  <tr className="text-left">
                    <th className="px-6 py-5 font-bold text-sm text-slate-700 uppercase tracking-wider">
                      Task
                    </th>
                    <th className="px-6 py-5 font-bold text-sm text-slate-700 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-5 font-bold text-sm text-slate-700 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-6 py-5 font-bold text-sm text-slate-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-5 font-bold text-sm text-slate-700 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-6 py-5 font-bold text-sm text-slate-700 uppercase tracking-wider text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-24">
                        <div className="flex flex-col items-center justify-center gap-4">
                          <div className="relative">
                            <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200"></div>
                            <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-600 border-t-transparent absolute top-0 left-0"></div>
                          </div>
                          <p className="text-lg font-bold text-slate-600 animate-pulse">
                            Loading tasks...
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-24">
                        <div className="flex flex-col items-center gap-6">
                          <div className="bg-gradient-to-br from-slate-100 to-slate-200 p-8 rounded-3xl">
                            <BarChart3 className="h-20 w-20 text-slate-400" />
                          </div>
                          <div className="text-center">
                            <h3 className="text-2xl font-black text-slate-700 mb-2">
                              No Tasks Found
                            </h3>
                            <p className="text-slate-500 font-medium">
                              You have completed all tasks for this client.
                            </p>
                          </div>
                        </div>
                        {searchQuery ||
                        statusFilter !== "all" ||
                        priorityFilter !== "all" ? (
                          <div className="mt-6 flex justify-center">
                            <Button
                              variant="outline"
                              className="rounded-2xl h-12 px-6 font-semibold border-2 hover:bg-slate-100 transition-all"
                              onClick={handleClearFilters}
                            >
                              Clear filters
                            </Button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ) : (
                    paginatedTasks.map((data) => (
                      <TaskRow
                        key={data.task.id}
                        data={data}
                        openContentWritingModal={openContentWritingModal}
                        openReviewRemovalModal={openReviewRemovalModal}
                        openBacklinkingModal={openBacklinkingModal}
                        openSummaryReportModal={openSummaryReportModal}
                        openMonitoringModal={openMonitoringModal}
                        openComplete={openComplete}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination controls */}
            <div className="mt-4 px-4 flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Showing{" "}
                {Math.min(filteredTasks.length, page * pageSize) -
                  (page - 1) * pageSize}{" "}
                of {filteredTasks.length}
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-10 rounded-lg border px-3"
                >
                  <option value={20}>20 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    Prev
                  </Button>
                  <span className="text-sm text-slate-600">
                    Page {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {isReadyForPostingCreation && (
            <div className="mt-8 flex justify-end">
              <Button
                onClick={createPostingTasks}
                disabled={creatingPosting}
                className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 shadow-2xl hover:shadow-indigo-500/50 hover:scale-105 transition-all duration-300 h-14 px-8 rounded-2xl font-bold text-lg"
              >
                {creatingPosting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Rss className="h-5 w-5 mr-3" />
                    Create Posting Tasks
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completion Dialog */}
      <Suspense fallback={<div>Loading...</div>}>
        <LazyCompletionDialog
          selected={selected}
          open={!!selected}
          link={link}
          email={email}
          username={username}
          password={password}
          doneBy={doneBy}
          completedAt={completedAt}
          clientEmail={clientEmail}
          lastUsedPassword={lastUsedPassword}
          agents={agents}
          agentSearchTerm={agentSearchTerm}
          setLink={setLink}
          setEmail={setEmail}
          setUsername={setUsername}
          setPassword={setPassword}
          setDoneBy={setDoneBy}
          setAgentSearchTerm={setAgentSearchTerm}
          setCompletedAt={setCompletedAt}
          resetModal={resetModal}
          submit={submit}
          setLastUsedAgent={setLastUsedAgent}
          setLastUsedDate={setLastUsedDate}
          isSimpleTask={isSimpleTask}
        />
      </Suspense>

      {/* Content Writing Modal */}
      <Suspense fallback={<div>Loading...</div>}>
        <LazyContentWritingModal
          open={contentWritingModalOpen}
          onOpenChange={setContentWritingModalOpen}
          task={selectedContentTask}
          clientId={clientId}
          onSuccess={() => {
            closeContentWritingModal();
            refetchTasks();
          }}
        />
      </Suspense>

      {/* Review Removal Modal */}
      <Suspense fallback={<div>Loading...</div>}>
        <LazyReviewRemovalModal
          open={reviewRemovalModalOpen}
          onOpenChange={setReviewRemovalModalOpen}
          task={selectedReviewRemovalTask}
          clientId={clientId}
          onSuccess={() => {
            closeReviewRemovalModal();
            refetchTasks();
          }}
        />
      </Suspense>

      {/* Backlinking Modal */}
      <Suspense fallback={<div>Loading...</div>}>
        <LazyBacklinkingModal
          open={backlinkingModalOpen}
          onOpenChange={setBacklinkingModalOpen}
          task={selectedBacklinkingTask}
          clientId={clientId}
          onSuccess={() => {
            closeBacklinkingModal();
            refetchTasks();
          }}
        />
      </Suspense>

      {/* Summary Report Modal */}
      <Suspense fallback={<div>Loading...</div>}>
        <LazySummaryReportModal
          open={summaryReportModalOpen}
          onOpenChange={setSummaryReportModalOpen}
          task={selectedSummaryReportTask}
          clientId={clientId}
          onSuccess={() => {
            closeSummaryReportModal();
            refetchTasks();
          }}
        />
      </Suspense>

      {/* Monitoring Dialog */}
      <Suspense fallback={<div>Loading...</div>}>
        <LazyMonitoringDialog
          open={monitoringModalOpen}
          onOpenChange={closeMonitoringModal}
          task={selectedMonitoringTask}
          clientId={clientId}
          onSuccess={() => {
            closeMonitoringModal();
            refetchTasks();
          }}
        />
      </Suspense>
    </div>
  );
}
