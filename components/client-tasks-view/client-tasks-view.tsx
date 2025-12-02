// apps/components/client-tasks-view/client-tasks-view.tsx

"use client";

import { useState, useEffect, useCallback, useMemo, useDeferredValue } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  Clock,
  Play,
  CheckCircle,
  AlertCircle,
  XCircle,
  TrendingUp,
  RefreshCw,
  Activity,
  ShieldCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Client } from "@/types/client";

import TaskList from "@/components/client-tasks-view/TaskList";
import TaskDialogs from "@/components/client-tasks-view/TaskDialogs";
import { BackgroundGradient } from "../ui/background-gradient";
import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const ClientDashboard = lazy(() =>
  import("@/components/clients/clientsID/client-dashboard").then((m) => ({
    default: m.ClientDashboard,
  }))
);

const ClientDashboardSkeleton = () => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-8 w-24 rounded-md" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="border border-muted/40">
          <CardHeader>
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
    <div className="space-y-2">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  </div>
);

/* =========================
   Types exported for children
========================= */
export interface Task {
  id: string;
  name: string;
  priority: "low" | "medium" | "high" | "urgent";
  status:
    | "pending"
    | "in_progress"
    | "completed"
    | "overdue"
    | "cancelled"
    | "reassigned"
    | "qc_approved";
  dueDate: string | null;
  idealDurationMinutes: number | null;
  actualDurationMinutes: number | null;
  performanceRating: "Excellent" | "Good" | "Average" | "Lazy" | null;
  completionLink: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;

  // ✅ NEW: reassignment notes from agents endpoint
  reassignNotes?: string | null;
  notes?: string | null; // fallback if your DB uses notes field

  assignment: {
    id: string;
    client: { id: string; name: string; avatar: string | null } | null;
    template: { id: string; name: string } | null;
  } | null;
  templateSiteAsset: {
    id: number;
    name: string;
    type: string;
    url: string | null;
  } | null;
  category: { id: string; name: string } | null;
  assignedTo: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    image: string | null;
  } | null;
  comments: Array<{
    id: string;
    text: string;
    date: string;
    author: {
      id: string;
      firstName: string;
      lastName: string;
      image: string | null;
    } | null;
  }>;
  qcTotalScore?: number | null;
  qcReview?: {
    timerScore?: number;
    keyword?: number;
    contentQuality?: number;
    image?: number;
    seo?: number;
    grammar?: number;
    humanization?: number;
    total?: number;
    reviewerId?: string | null;
    reviewedAt?: string;
    notes?: string | null;
  } | null;
  email?: string | null;
  username?: string | null;
}
export interface TaskStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
  cancelled: number;
  reassigned: number;
  qc_approved: number;
}
export interface TimerState {
  taskId: string;
  remainingSeconds: number;
  isRunning: boolean;
  totalSeconds: number;
  isGloballyLocked: boolean;
  lockedByAgent?: string;
  startedAt?: number;
}
interface GlobalTimerLock {
  isLocked: boolean;
  taskId: string | null;
  agentId: string | null;
  taskName: string | null;
}
interface ClientTasksViewProps {
  clientId: string;
  clientName: string;
  agentId: string;
  onBack: () => void;
  isLockedBySelf?: boolean;
  lockedTaskId?: string | null;
  lockedTaskName?: string | null;
  excludedCategories?: string[];
}
interface Agent {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
}

// ===== Storage keys =====
const RUN_KEY = "runningTaskTimer"; // only the actively running timer
const PAUSE_KEY = "pausedTaskTimer"; // at most one paused task
const LOCK_KEY = "globalTimerLock"; // navigation lock

// Exclude these categories from display
const EXCLUDED_CATEGORIES = ["Social Communication"];

type StoredTimer = TimerState & { savedAt?: number; agentId?: string };

/* =========================
   Utils
========================= */
const formatTimerDisplay = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
};

const getStatusBadge = (status: string) => {
  const statusConfig = {
    pending: {
      className:
        "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800/50 dark:text-slate-400 border-slate-300 dark:border-slate-700",
      icon: Clock,
      label: "Pending",
    },
    in_progress: {
      className:
        "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300 dark:border-blue-800",
      icon: Play,
      label: "In Progress",
    },
    completed: {
      className:
        "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800",
      icon: CheckCircle,
      label: "Completed",
    },
    qc_approved: {
      className:
        "bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400 border-purple-300 dark:border-purple-800",
      icon: ShieldCheck,
      label: "QC Approved",
    },
    overdue: {
      className:
        "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 border-red-300 dark:border-red-800",
      icon: AlertCircle,
      label: "Overdue",
    },
    cancelled: {
      className:
        "bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-400 border-gray-300 dark:border-gray-700",
      icon: XCircle,
      label: "Cancelled",
    },
    reassigned: {
      className:
        "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300 dark:border-amber-800",
      icon: TrendingUp,
      label: "Reassigned",
    },
  } as const;

  const config = statusConfig[status as keyof typeof statusConfig];
  if (!config) return <Badge variant="secondary">{status}</Badge>;
  const Icon = config.icon;
  return (
    <Badge className={config.className}>
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
};

const getPriorityBadge = (priority: string) => {
  const priorityConfig = {
    low: {
      className:
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      label: "Low",
    },
    medium: {
      className:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      label: "Medium",
    },
    high: {
      className:
        "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
      label: "High",
    },
    urgent: {
      className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      label: "Urgent",
    },
  } as const;

  const config = priorityConfig[priority as keyof typeof priorityConfig];
  if (!config) return <Badge variant="secondary">{priority}</Badge>;
  return <Badge className={config.className}>{config.label}</Badge>;
};

/* =========================
   Main Component
========================= */
export function ClientTasksView({
  clientId,
  clientName,
  agentId,
  onBack,
  isLockedBySelf = false,
  lockedTaskId = null,
  lockedTaskName = null,
  excludedCategories = EXCLUDED_CATEGORIES,
}: ClientTasksViewProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const deferredSearch = useDeferredValue(searchTerm.trim().toLowerCase());
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const [globalTimerLock, setGlobalTimerLock] = useState<GlobalTimerLock>({
    isLocked: false,
    taskId: null,
    agentId: null,
    taskName: null,
  });
  const [stats, setStats] = useState<TaskStats>({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0,
    cancelled: 0,
    reassigned: 0,
    qc_approved: 0,
  });
  const [isCompletionConfirmOpen, setIsCompletionConfirmOpen] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState<Task | null>(null);
  const [completionLink, setCompletionLink] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isBulkCompletionOpen, setIsBulkCompletionOpen] = useState(false);
  const [bulkCompletionLink, setBulkCompletionLink] = useState("");
  const [clientData, setClientData] = useState<Client | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [pausedTimer, setPausedTimer] = useState<TimerState | null>(null); // new

  const loadPausedFromStorage = useCallback(() => {
    try {
      const raw = localStorage.getItem("pausedTaskTimer"); // PAUSE_KEY
      if (raw) {
        const p = JSON.parse(raw) as TimerState & {
          savedAt?: number;
          agentId?: string;
        };
        setPausedTimer({
          taskId: p.taskId,
          remainingSeconds: Math.max(0, p.remainingSeconds ?? 0),
          isRunning: false,
          totalSeconds: p.totalSeconds,
          isGloballyLocked: false,
          lockedByAgent: p.lockedByAgent,
          startedAt: p.startedAt || Date.now(),
        });
      } else {
        setPausedTimer(null);
      }
    } catch {
      setPausedTimer(null);
    }
  }, []);

  // ✅ UPDATED: fetch only from agents endpoint to get reassignNotes
  const fetchClientTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/agents/${agentId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const json = await response.json();
      const agentAllTasks: Task[] = json.tasks ?? [];

      // ✅ Filter only tasks for this client
      const agentTasksForClient = agentAllTasks.filter((task) => {
        const cid =
          task.assignment?.client?.id ??
          (task as any).clientId ??
          (task as any)?.assignment?.clientId;
        return cid === clientId;
      });

      // Filter out excluded categories
      const visibleTasks = agentTasksForClient.filter(
        (t) => !EXCLUDED_CATEGORIES.includes(t.category?.name ?? "")
      );

      setTasks(visibleTasks);

      setStats({
        total: visibleTasks.length,
        pending: visibleTasks.filter((t) => t.status === "pending").length,
        inProgress: visibleTasks.filter((t) => t.status === "in_progress")
          .length,
        completed: visibleTasks.filter((t) => t.status === "completed").length,
        overdue: visibleTasks.filter((t) => t.status === "overdue").length,
        cancelled: visibleTasks.filter((t) => t.status === "cancelled").length,
        reassigned: visibleTasks.filter((t) => t.status === "reassigned")
          .length,
        qc_approved: visibleTasks.filter((t) => t.status === "qc_approved")
          .length,
      });
    } catch (err: any) {
      const errorMessage = err.message || "Failed to fetch client tasks.";
      setError(errorMessage);
      console.error("Failed to fetch client tasks:", err);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [clientId, agentId]);

  // Normalize and fetch full client data for the modal
  const normalizeClientData = useCallback((apiData: any): Client => {
    const uncategorized = {
      id: "uncategorized",
      name: "Uncategorized",
      description: "",
    } as any;
    return {
      ...apiData,
      companywebsite:
        apiData?.companywebsite && typeof apiData.companywebsite === "string"
          ? apiData.companywebsite
          : "",
      tasks: (apiData?.tasks ?? []).map((t: any) => ({
        ...t,
        categoryId: t?.category?.id ?? t?.categoryId ?? "uncategorized",
        category: t?.category ?? uncategorized,
        name: String(t?.name ?? ""),
        priority: String(t?.priority ?? "medium"),
        status: String(t?.status ?? "pending"),
        templateSiteAsset: {
          ...t?.templateSiteAsset,
          type: String(t?.templateSiteAsset?.type ?? ""),
          name: String(t?.templateSiteAsset?.name ?? ""),
          url: String(t?.templateSiteAsset?.url ?? ""),
        },
      })),
    } as Client;
  }, []);

  const fetchClientData = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const raw = await res.json();
      const normalized = normalizeClientData(raw);
      setClientData(normalized);
    } catch (e) {
      console.error("Failed to fetch client data:", e);
    }
  }, [clientId, normalizeClientData]);

  useEffect(() => {
    if (isClientModalOpen) {
      fetchClientData();
    }
  }, [isClientModalOpen, fetchClientData]);

  // ✅ PATCH merge-guard
  const handleUpdateTask = useCallback(
    async (taskId: string, updates: any) => {
      try {
        const response = await fetch(`/api/tasks/agents/${agentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, ...updates }),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.message || `HTTP error! status: ${response.status}`
          );
        }
        const updatedTask = await response.json();

        setTasks((prev) =>
          prev.map((t) => {
            if (t.id !== taskId) return t;

            const merged: any = { ...t, ...updatedTask };

            if (updatedTask.templateSiteAsset == null)
              merged.templateSiteAsset = t.templateSiteAsset;
            if (updatedTask.assignment == null)
              merged.assignment = t.assignment;
            if (updatedTask.category == null) merged.category = t.category;
            if (updatedTask.completionLink == null)
              merged.completionLink = t.completionLink;
            if (updatedTask.email == null) merged.email = t.email;
            if (updatedTask.username == null) merged.username = t.username;
            if (updatedTask.reassignNotes == null)
              merged.reassignNotes = t.reassignNotes; // ✅ keep old note if patch doesn't return it

            return merged as Task;
          })
        );
        return updatedTask;
      } catch (err: any) {
        console.error("Failed to update task:", err);
        throw err;
      }
    },
    [agentId]
  );

  const saveTimerToStorage = useCallback(
    (timer: TimerState | null) => {
      try {
        if (timer === null) {
          localStorage.removeItem(RUN_KEY);

          const unlock: GlobalTimerLock = {
            isLocked: false,
            taskId: null,
            agentId: null,
            taskName: null,
          };
          localStorage.setItem(LOCK_KEY, JSON.stringify(unlock));
          setGlobalTimerLock(unlock);

          localStorage.removeItem("taskTimer");
          localStorage.removeItem("globalTimerLock");
          return;
        }

        const now = Date.now();

        if (timer.isRunning) {
          const runningData: StoredTimer = { ...timer, savedAt: now, agentId };
          localStorage.setItem(RUN_KEY, JSON.stringify(runningData));

          try {
            const pausedRaw = localStorage.getItem(PAUSE_KEY);
            if (pausedRaw) {
              const paused: StoredTimer = JSON.parse(pausedRaw);
              if (paused.taskId === timer.taskId) {
                localStorage.removeItem(PAUSE_KEY);
              }
            }
          } catch {}

          const lockState: GlobalTimerLock = {
            isLocked: true,
            taskId: timer.taskId,
            agentId,
            taskName: tasks.find((t) => t.id === timer.taskId)?.name || null,
          };
          localStorage.setItem(LOCK_KEY, JSON.stringify(lockState));
          setGlobalTimerLock(lockState);

          localStorage.setItem("taskTimer", JSON.stringify(runningData));
          localStorage.setItem("globalTimerLock", JSON.stringify(lockState));
          return;
        }

        const pausedData: StoredTimer = { ...timer, savedAt: now, agentId };
        localStorage.setItem(PAUSE_KEY, JSON.stringify(pausedData));

        localStorage.removeItem(RUN_KEY);
        const unlock: GlobalTimerLock = {
          isLocked: false,
          taskId: null,
          agentId: null,
          taskName: null,
        };
        localStorage.setItem(LOCK_KEY, JSON.stringify(unlock));
        setGlobalTimerLock(unlock);

        localStorage.setItem("taskTimer", JSON.stringify(pausedData));
        localStorage.setItem("globalTimerLock", JSON.stringify(unlock));
      } catch (e) {
        console.error("Failed to save timer to storage:", e);
      }
    },
    [agentId, tasks, setGlobalTimerLock]
  );

  const loadTimerFromStorage = useCallback(() => {
    try {
      const raw =
        localStorage.getItem(RUN_KEY) ?? localStorage.getItem("taskTimer");
      const lockRaw =
        localStorage.getItem(LOCK_KEY) ??
        localStorage.getItem("globalTimerLock");

      if (raw) {
        const timerData = JSON.parse(raw) as StoredTimer;

        let remaining = timerData.remainingSeconds;
        if (timerData.isRunning) {
          const elapsed = Math.floor(
            (Date.now() - (timerData.savedAt || Date.now())) / 1000
          );
          remaining = Math.max(0, remaining - elapsed);
        }

        const restored: TimerState = {
          taskId: timerData.taskId,
          remainingSeconds: remaining,
          isRunning: !!timerData.isRunning,
          totalSeconds: timerData.totalSeconds,
          isGloballyLocked: !!timerData.isGloballyLocked,
          lockedByAgent: timerData.lockedByAgent,
          startedAt: timerData.startedAt || Date.now(),
        };

        setTimerState(restored);

        if (lockRaw) {
          const lock = JSON.parse(lockRaw) as GlobalTimerLock;
          setGlobalTimerLock(lock);
        }

        const task = tasks.find((t) => t.id === restored.taskId);
        toast.info(
          restored.isRunning
            ? `Timer restored for "${task?.name || "Unknown Task"}".`
            : `Paused timer data available for "${
                task?.name || "Unknown Task"
              }".`
        );
        return restored;
      }
    } catch (e) {
      console.error("Failed to load timer:", e);
    }
    return null;
  }, [tasks]);

  useEffect(() => {
    if (tasks.length > 0) {
      loadTimerFromStorage();
      loadPausedFromStorage();
    }
  }, [tasks, loadTimerFromStorage, loadPausedFromStorage]);

  const isTaskDisabled = useCallback((_taskId: string) => false, []);
  const isAnyTimerRunning = globalTimerLock.isLocked;
  const isBackButtonDisabled = isAnyTimerRunning;

  const handleStartTimer = useCallback(
    async (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task?.idealDurationMinutes) return;

      if (globalTimerLock.isLocked && timerState?.taskId !== taskId) {
        toast.error("Please Pause the current running task!!!");
        return;
      }

      try {
        await handleUpdateTask(taskId, { status: "in_progress" });

        const totalSeconds = (task.idealDurationMinutes ?? 0) * 60;

        let remainingSeconds: number | undefined;
        try {
          const pausedRaw = localStorage.getItem(PAUSE_KEY);
          if (pausedRaw) {
            const paused: StoredTimer = JSON.parse(pausedRaw);
            if (paused.taskId === taskId) {
              remainingSeconds = Math.max(0, paused.remainingSeconds);
              localStorage.removeItem(PAUSE_KEY);
              setPausedTimer(null);
            }
          }
        } catch {}

        if (remainingSeconds == null) {
          remainingSeconds =
            timerState?.taskId === taskId
              ? timerState.remainingSeconds
              : totalSeconds;
        }

        const newTimer: TimerState = {
          taskId,
          remainingSeconds,
          isRunning: true,
          totalSeconds: totalSeconds > 0 ? totalSeconds : remainingSeconds,
          isGloballyLocked: true,
          lockedByAgent: agentId,
          startedAt: Date.now(),
        };

        setTimerState(newTimer);
        saveTimerToStorage(newTimer);

        toast.success(
          `Timer ${
            remainingSeconds !== totalSeconds ? "resumed" : "started"
          } for "${task.name}".`
        );
      } catch {
        toast.error("Failed to start timer");
      }
    },
    [
      tasks,
      timerState,
      globalTimerLock.isLocked,
      saveTimerToStorage,
      handleUpdateTask,
      agentId,
      setPausedTimer,
    ]
  );

  const handlePauseTimer = useCallback(
    (taskId: string) => {
      if (!timerState || timerState.taskId !== taskId) return;

      try {
        const existing = localStorage.getItem(PAUSE_KEY);
        if (existing) {
          const paused: StoredTimer = JSON.parse(existing);
          if (paused.taskId !== taskId) {
            toast.error(
              "Another task is already paused. Resume or complete it before pausing this task."
            );
            return;
          }
        }
      } catch {}

      if (timerState?.taskId === taskId) {
        const updatedTimer = {
          ...timerState,
          isRunning: false,
          isGloballyLocked: false,
        };

        setTimerState(updatedTimer);
        setPausedTimer(updatedTimer);
        saveTimerToStorage(updatedTimer);

        const task = tasks.find((t) => t.id === taskId);
        toast.info(
          `Timer paused for "${task?.name}". All tasks are now unlocked.`
        );
      }
    },
    [timerState, tasks, saveTimerToStorage]
  );

  const handleResetTimer = useCallback(
    (taskId: string) => {
      if (timerState?.taskId === taskId) {
        const task = tasks.find((t) => t.id === taskId);
        if (!task?.idealDurationMinutes) return;

        const totalSeconds = task.idealDurationMinutes * 60;

        try {
          const pausedRaw = localStorage.getItem(PAUSE_KEY);
          if (pausedRaw) {
            const paused: StoredTimer = JSON.parse(pausedRaw);
            if (paused.taskId === taskId) {
              localStorage.removeItem(PAUSE_KEY);
            }
          }
        } catch {}

        const updatedTimer: TimerState = {
          taskId,
          remainingSeconds: totalSeconds,
          isRunning: false,
          totalSeconds,
          isGloballyLocked: false,
        };

        setTimerState(updatedTimer);
        saveTimerToStorage(null);

        if (pausedTimer?.taskId === taskId) {
          setPausedTimer(null);
          try {
            localStorage.removeItem("pausedTaskTimer");
          } catch {}
        }

        toast.info(`Timer reset for "${task?.name}".`);
      }
    },
    [timerState, tasks, saveTimerToStorage, pausedTimer]
  );

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
  };

  const stopTimerNow = useCallback(
    (taskId: string) => {
      if (timerState?.taskId !== taskId) return;

      const snapshot = timerState;
      setTimerState(null);
      saveTimerToStorage(null);
      try {
        localStorage.removeItem("pausedTaskTimer");
      } catch {}

      return snapshot;
    },
    [timerState, saveTimerToStorage]
  );

  const handleTaskCompletion = useCallback(async () => {
    if (!taskToComplete) return;

    let actualDurationMinutes = taskToComplete.actualDurationMinutes;
    let performanceRating: "Excellent" | "Good" | "Average" | "Poor" | "Lazy" =
      "Average";

    if (
      timerState?.taskId === taskToComplete.id &&
      taskToComplete.idealDurationMinutes
    ) {
      const totalTimeUsedSeconds =
        (timerState.totalSeconds || 0) - (timerState.remainingSeconds || 0);
      const mins = Math.ceil(totalTimeUsedSeconds / 60);
      actualDurationMinutes = Math.max(1, mins || 0);

      const ratio =
        actualDurationMinutes / taskToComplete.idealDurationMinutes;
      if (ratio <= 1.2) performanceRating = "Excellent";
      else if (ratio <= 1.5) performanceRating = "Good";
      else if (ratio <= 2.0) performanceRating = "Average";
      else if (ratio <= 3.0) performanceRating = "Poor";
      else performanceRating = "Lazy";
    }

    const rollback = stopTimerNow(taskToComplete.id);

    try {
      const updates: any = {
        status: "completed",
        completedAt: new Date().toISOString(),
      };
      if (completionLink?.trim()) updates.completionLink = completionLink.trim();
      if (username?.trim()) updates.username = username.trim();
      if (email?.trim()) updates.email = email.trim();
      if (password?.trim()) updates.password = password;
      if (typeof actualDurationMinutes === "number") {
        updates.actualDurationMinutes = actualDurationMinutes;
        updates.performanceRating = performanceRating;
      }

      await handleUpdateTask(taskToComplete.id, updates);

      setTasks((prev) =>
        prev.map((t) => (t.id === taskToComplete.id ? { ...t, ...updates } : t))
      );

      setIsCompletionConfirmOpen(false);
      setTaskToComplete(null);
      setCompletionLink("");
      setUsername("");
      setEmail("");
      setPassword("");

      if (
        timerState?.taskId === taskToComplete.id &&
        taskToComplete.idealDurationMinutes
      ) {
        if ((timerState?.remainingSeconds ?? 0) <= 0) {
          toast.success(
            `Task "${taskToComplete.name}" completed with overtime!`
          );
        } else {
          toast.success(
            `Task "${taskToComplete.name}" completed ahead of schedule!`
          );
        }
      } else {
        toast.success(`Task "${taskToComplete.name}" marked as completed!`);
      }
    } catch (e) {
      if (rollback) {
        setTimerState(rollback);
        if (rollback.isRunning) saveTimerToStorage(rollback);
      }
      console.error("Failed to complete task:", e);
      toast.error("Failed to complete task. Please try again.");
    }
  }, [
    taskToComplete,
    timerState,
    completionLink,
    username,
    email,
    password,
    stopTimerNow,
    handleUpdateTask,
    saveTimerToStorage,
  ]);

  const handleCompletionCancel = useCallback(() => {
    setIsCompletionConfirmOpen(false);
    setTaskToComplete(null);
    setCompletionLink("");
  }, []);

  const handleUpdateSelectedTasks = useCallback(
    async (
      action: "completed" | "pending" | "reassigned",
      completionLink?: string
    ) => {
      if (action === "completed") {
        const tasksToComplete = selectedTasks
          .map((id) => tasks.find((t) => t.id === id))
          .filter(
            (t): t is Task => t !== undefined && t.status !== "completed"
          );

        if (tasksToComplete.length === 1) {
          setTaskToComplete(tasksToComplete[0]);
          setIsCompletionConfirmOpen(true);
          return;
        } else if (tasksToComplete.length > 1) {
          setIsBulkCompletionOpen(true);
          return;
        }
      }

      setIsUpdating(true);
      try {
        let successCount = 0;
        let errorCount = 0;

        for (const taskId of selectedTasks) {
          try {
            const updates: any = { status: action };

            if (action === "completed") {
              updates.completedAt = new Date().toISOString();
              if (completionLink && completionLink.trim()) {
                updates.completionLink = completionLink.trim();
              }
              const task = tasks.find((t) => t.id === taskId);
              if (timerState?.taskId === taskId && task?.idealDurationMinutes) {
                const totalTimeUsedSeconds =
                  timerState.totalSeconds - timerState.remainingSeconds;
                const actualDurationMinutes = Math.ceil(
                  totalTimeUsedSeconds / 60
                );

                if (actualDurationMinutes > 0) {
                  updates.actualDurationMinutes = actualDurationMinutes;

                  const ratio =
                    actualDurationMinutes / task.idealDurationMinutes;
                  if (ratio <= 1.2) updates.performanceRating = "Excellent";
                  else if (ratio <= 1.5) updates.performanceRating = "Good";
                  else if (ratio <= 2.0) updates.performanceRating = "Average";
                  else if (ratio <= 3.0) updates.performanceRating = "Poor";
                  else updates.performanceRating = "Lazy";
                }
              }
            }

            await handleUpdateTask(taskId, updates);
            setTasks((prev) =>
              prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
            );
            successCount++;

            if (action === "completed" && timerState?.taskId === taskId) {
              setTimerState(null);
              saveTimerToStorage(null);
            }
          } catch {
            errorCount++;
          }
        }

        if (successCount > 0) {
          toast.success(
            `Successfully updated ${successCount} task${
              successCount !== 1 ? "s" : ""
            } to ${action === "completed" ? "completed" : action}`
          );
        }
        if (errorCount > 0) {
          toast.error(
            `Failed to update ${errorCount} task${errorCount !== 1 ? "s" : ""}`
          );
        }
        setSelectedTasks([]);
        setIsStatusModalOpen(false);
        setIsBulkCompletionOpen(false);
        setBulkCompletionLink("");
      } catch (err: any) {
        console.error("Failed to update tasks:", err);
        toast.error("Failed to update tasks. Please try again.");
      } finally {
        setIsUpdating(false);
      }
    },
    [selectedTasks, handleUpdateTask, tasks, timerState, saveTimerToStorage]
  );

  const handleBulkCompletion = useCallback(() => {
    handleUpdateSelectedTasks("completed", bulkCompletionLink);
  }, [handleUpdateSelectedTasks, bulkCompletionLink]);

  const handleBulkCompletionCancel = useCallback(() => {
    setIsBulkCompletionOpen(false);
    setBulkCompletionLink("");
  }, []);

  const filteredTasks = useMemo(() => {
    const needle = deferredSearch;
    return tasks
      .filter((task) => {
        const matchesSearch =
          needle.length === 0 ||
          task.name.toLowerCase().includes(needle) ||
          task.category?.name?.toLowerCase().includes(needle) ||
          task.templateSiteAsset?.name?.toLowerCase().includes(needle);
        const matchesStatus =
          statusFilter === "all" || task.status === statusFilter;
        const matchesPriority =
          priorityFilter === "all" || task.priority === priorityFilter;
        return matchesSearch && matchesStatus && matchesPriority;
      })
      .sort((a, b) => {
        if (a.status === "reassigned" && b.status !== "reassigned") return -1;
        if (b.status === "reassigned" && a.status !== "reassigned") return 1;
        return 0;
      });
  }, [deferredSearch, priorityFilter, statusFilter, tasks]);

  const overdueCount = tasks.filter((task) => task.status === "overdue").length;

  useEffect(() => {
    fetchClientTasks();
  }, [fetchClientTasks]);

  useEffect(() => {
    setStats({
      total: tasks.length,
      pending: tasks.filter((t) => t.status === "pending").length,
      inProgress: tasks.filter((t) => t.status === "in_progress").length,
      completed: tasks.filter((t) => t.status === "completed").length,
      overdue: tasks.filter((t) => t.status === "overdue").length,
      cancelled: tasks.filter((t) => t.status === "cancelled").length,
      reassigned: tasks.filter((t) => t.status === "reassigned").length,
      qc_approved: tasks.filter((t) => t.status === "qc_approved").length,
    });
  }, [tasks]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (timerState?.isRunning) {
      interval = setInterval(() => {
        setTimerState((prev) => {
          if (!prev || !prev.isRunning) return prev;
          const newRemainingSeconds = prev.remainingSeconds - 1;
          const updatedTimer = {
            ...prev,
            remainingSeconds: newRemainingSeconds,
          };

          if (newRemainingSeconds === 0) {
            const task = tasks.find((t) => t.id === prev.taskId);
            if (task && task.status === "in_progress") {
              handleUpdateTask(prev.taskId, { status: "overdue" })
                .then(() => {
                  toast.warning(`Task "${task.name}" is now overdue!`, {
                    description: "Timer has exceeded the ideal duration",
                    duration: 4000,
                  });
                })
                .catch(() => console.error("Failed to set overdue"));
            }
          }

          if (newRemainingSeconds % 5 === 0 || newRemainingSeconds === 0) {
            saveTimerToStorage(updatedTimer);
          }
          return updatedTimer;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerState?.isRunning, saveTimerToStorage, tasks, handleUpdateTask]);

  useEffect(() => {
    if (tasks.length > 0) loadTimerFromStorage();
  }, [tasks, loadTimerFromStorage]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Loading tasks...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full w-fit mx-auto">
            <Activity className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <div className="space-y-2">
            <p className="text-lg font-medium text-red-600 dark:text-red-400">
              Error: {error}
            </p>
            <Button
              onClick={fetchClientTasks}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const onBackToClients = () => {
    if (isAnyTimerRunning) {
      toast.error(
        "Cannot navigate back while a timer is running. Please pause or complete the task first."
      );
      return;
    }
    onBack();
  };

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-blue-900/20 dark:to-indigo-900/20 p-4 lg:p-8">
      <div className="space-y-8 w-full max-w-[100vw] overflow-x-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={onBackToClients}
              className={`hover:bg-white/50 dark:hover:bg-gray-800/50 rounded-xl p-3 ${
                isBackButtonDisabled
                  ? "opacity-50 cursor-not-allowed hover:bg-transparent dark:hover:bg-transparent"
                  : ""
              }`}
              disabled={isBackButtonDisabled}
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Clients
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">
                {clientName}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Task Management Dashboard
              </p>
            </div>
          </div>
          <Button
            onClick={fetchClientTasks}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 bg-transparent"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-100">
                Total Tasks
              </CardTitle>
              <div className="p-2 bg-white/20 rounded-lg">
                <Activity className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold text-white">{tasks.length}</div>
              <p className="text-xs text-blue-100 mt-1">All assigned tasks</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-100">
                Completed
              </CardTitle>
              <div className="p-2 bg-white/20 rounded-lg">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold text-white">
                {stats.completed}
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-amber-100">
                In Progress
              </CardTitle>
              <div className="p-2 bg-white/20 rounded-lg">
                <Play className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold text-white">
                {stats.inProgress}
              </div>
              <p className="text-xs text-amber-100 mt-1">
                Currently working on
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-red-500 to-red-600 text-white">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-100">
                Overdue
              </CardTitle>
              <div className="p-2 bg-white/20 rounded-lg">
                <AlertCircle className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold text-white">
                {overdueCount}
              </div>
              <p className="text-xs text-red-100 mt-1">
                Need immediate attention
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-100">
                QC Approved
              </CardTitle>
              <div className="p-2 bg-white/20 rounded-lg">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold text-white">
                {stats.qc_approved}
              </div>
              <p className="text-xs text-purple-100 mt-1">Approved by QC</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Dialog open={isClientModalOpen} onOpenChange={setIsClientModalOpen}>
            <DialogTrigger asChild>
              <Button className="relative rounded-2xl p-0 bg-transparent hover:bg-transparent overflow-hidden isolate">
                <BackgroundGradient className="rounded-2xl">
                  <div className="rounded-2xl px-5 py-2.5 text-white">
                    Open Client&apos;s Information
                  </div>
                </BackgroundGradient>
              </Button>
            </DialogTrigger>

            <DialogContent className="w-[95vw] max-w-6xl h-[90vh] overflow-y-auto overflow-x-hidden bg-transparent p-0">
              <div className="bg-card p-6">
                <DialogHeader className="mb-4">
                  <DialogTitle>{clientName}</DialogTitle>
                </DialogHeader>

                {clientData ? (
                  <Suspense fallback={<ClientDashboardSkeleton />}>
                    <ClientDashboard clientData={clientData} />
                  </Suspense>
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Loading client info...
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="max-w-full overflow-x-hidden">
          <TaskList
            agentId={agentId}
            clientName={clientName}
            tasks={tasks}
            filteredTasks={filteredTasks}
            overdueCount={overdueCount}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            priorityFilter={priorityFilter}
            setPriorityFilter={setPriorityFilter}
            selectedTasks={selectedTasks}
            setSelectedTasks={setSelectedTasks}
            timerState={timerState}
            handleStartTimer={handleStartTimer}
            handlePauseTimer={handlePauseTimer}
            isTaskDisabled={isTaskDisabled}
            viewMode={viewMode}
            setViewMode={setViewMode}
            onOpenStatusModal={() => setIsStatusModalOpen(true)}
            taskToComplete={taskToComplete}
            setTaskToComplete={setTaskToComplete}
            isCompletionConfirmOpen={isCompletionConfirmOpen}
            setIsCompletionConfirmOpen={setIsCompletionConfirmOpen}
            getStatusBadge={getStatusBadge}
            onTaskComplete={handleTaskCompletion}
            getPriorityBadge={getPriorityBadge}
            formatTimerDisplay={formatTimerDisplay}
            pausedTimer={pausedTimer}
          />
        </div>

        <TaskDialogs
          isStatusModalOpen={isStatusModalOpen}
          setIsStatusModalOpen={setIsStatusModalOpen}
          selectedTasks={selectedTasks}
          isUpdating={isUpdating}
          handleUpdateSelectedTasks={handleUpdateSelectedTasks}
          isCompletionConfirmOpen={isCompletionConfirmOpen}
          setIsCompletionConfirmOpen={setIsCompletionConfirmOpen}
          taskToComplete={taskToComplete}
          setTaskToComplete={setTaskToComplete}
          completionLink={completionLink}
          setCompletionLink={setCompletionLink}
          username={username}
          setUsername={setUsername}
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          timerState={timerState}
          handleTaskCompletion={handleTaskCompletion}
          handleCompletionCancel={handleCompletionCancel}
          isBulkCompletionOpen={isBulkCompletionOpen}
          setIsBulkCompletionOpen={setIsBulkCompletionOpen}
          bulkCompletionLink={bulkCompletionLink}
          setBulkCompletionLink={setBulkCompletionLink}
          handleBulkCompletion={handleBulkCompletion}
          handleBulkCompletionCancel={handleBulkCompletionCancel}
          tasks={tasks}
          formatTimerDisplay={formatTimerDisplay}
          clientId={clientId}
          clientName={clientName}
          pausedTimer={pausedTimer}
          refreshTasks={fetchClientTasks}
          stopTimer={stopTimerNow}
        />
      </div>
    </div>
  );
}
