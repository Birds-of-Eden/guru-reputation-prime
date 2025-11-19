// app/[role]/distribution/client-agent/[clientId]/page.tsx

"use client";

import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useDeferredValue,
  useTransition,
} from "react";
import useSWR from "swr";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Calendar as CalendarIcon,
  Building2,
  Repeat,
  CheckCircle2,
  Star,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getInitialsFromName, nameToColor } from "@/utils/avatar";

import type {
  Agent,
  Client,
  Task,
} from "@/components/task-distribution/distribution-types";
import { LoadingSpinner } from "@/components/task-distribution/LoadingSpinner";

// OPTIMIZATION (Next.js dynamic import): split the large TaskTabs bundle for a lighter first paint.
const TaskTabs = dynamic(
  () =>
    import("@/components/task-distribution/TaskTabs").then(
      (mod) => mod.TaskTabs
    ),
  {
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    ),
    ssr: false,
  }
);

// OPTIMIZATION (Next.js dynamic import): load the modal lazily so it doesn't block interactive time.
const ReassignModal = dynamic(
  () =>
    import("@/components/task-distribution/ReassignModal").then(
      (mod) => mod.ReassignModal
    ),
  {
    loading: () => null,
    ssr: false,
  }
);

/* =========================
   Helpers (hoisted)
   ========================= */

// Asset-type enum → human-facing label (existing logic)
function mapSiteAssetTypeToCategory(type: string | undefined): string {
  if (!type) return "Other";
  if (type === "graphics_design") return "Graphics Design";
  if (["social_site", "web2_site", "other_asset"].includes(type)) {
    return "Asset Creation";
  }
  const labels: Record<string, string> = {
    content_studio: "Content Studio",
    image_optimization: "Image Optimization",
    content_writing: "Content Writing",
    backlinks: "Backlinks",
    completed_com: "Completed Communication",
    youtube_video_optimization: "YouTube Video Optimization",
    monitoring: "Monitoring",
    review_removal: "Review Removal",
    summary_report: "Summary Report",
    guest_posting: "Guest Posting",
  };
  return labels[type] ?? type;
}

// ✅ NEW: Posting categories to show (order matters; after Asset Creation)
const POSTING_CATEGORIES = [
  "Social Activity",
  "Blog Posting",
  "Social Communication",
] as const;

// --- Team routing maps (ids from your Team table) ---
const TEAM_ID_BY_CATEGORY: Record<string, string> = {
  "Asset Creation": "asset-team",
  "Image Optimization": "asset-team",
  "AWS Upload": "asset-team",
  "Graphics Design": "graphics-design-team",
  // ✅ NEW: both go to social-team
  "Social Activity": "social-team",
  "Blog Posting": "social-team",
  "Social Communication": "social-team", // NEW

  "Content Studio": "content-studio-team",
  "Content Writing": "content-writing",
  Backlinks: "backlinks-team",
  "Completed Communication": "completedcom-",
  "YouTube Video Optimization": "youtube-video-optimizer-",
  Monitoring: "monitoring-team",
  "Review Removal": "review-removal-team",
  "Summary Report": "summary-report-team",
  "Guest Posting": "monthly-report-team",
};

// Optional pretty names
const TEAM_NAME_BY_ID: Record<string, string> = {
  "social-team": "Social Team",
  "graphics-design-team": "Graphics Design Team",
  "content-studio-team": "Content Studio Team",
  "content-writing": "Content Writing",
  "backlinks-team": "Backlinks Team",
  "completedcom-": "Completed.com Team",
  "youtube-video-optimizer-": "YouTube Video Optimizer",
  "monitoring-team": "Monitoring Team",
  "review-removal-team": "Review Removal Team",
  "summary-report-team": "Summary Report Team",
  "monthly-report-team": "Guest Posting Team",
  "asset-team": "Asset Team",
  "design-team": "Design Team",
  "developer-team": "Developer Team",
  "qc-team": "QC Team",
};

// ✅ Dropdown options (Asset Creation, then new posting categories)
const CATEGORY_LABELS = [
  "Graphics Design",
  "Asset Creation",
  "Image Optimization",
  "AWS Upload",
  ...POSTING_CATEGORIES,
  "Content Studio",
  "Content Writing",
  "Backlinks",
  "Completed Communication",
  "YouTube Video Optimization",
  "Monitoring",
  "Review Removal",
  "Summary Report",
  "Guest Posting",
];

// OPTIMIZATION (virtual batching): cap initial DOM work to manageable slices.
const TASK_BATCH_SIZE = 40;

function teamIdForCategory(cat: string) {
  return TEAM_ID_BY_CATEGORY[cat] ?? "social-team";
}
function teamNameForCategory(cat: string) {
  const id = teamIdForCategory(cat);
  return TEAM_NAME_BY_ID[id] ?? id;
}

// Weighted load helpers (existing)
type AgentWithLoad = Agent & {
  byStatus?: Record<string, number>;
  activeCount?: number;
  weightedScore?: number;
  displayLabel?: string;
};
const WEIGHTS = { P: 1, IP: 2, O: 3, R: 2 };

function safeName(a: Partial<Agent>) {
  return (
    (a as any)?.name ||
    `${(a as any)?.firstName ?? ""} ${(a as any)?.lastName ?? ""}`.trim() ||
    (a as any)?.email ||
    "Agent"
  );
}
function computeWeighted(byStatus: Record<string, number> = {}) {
  const P = byStatus["pending"] ?? 0;
  const IP = byStatus["in_progress"] ?? 0;
  const O = byStatus["overdue"] ?? 0;
  const R = byStatus["reassigned"] ?? 0;
  return {
    activeCount: P + IP + O + R,
    weightedScore:
      P * WEIGHTS.P + IP * WEIGHTS.IP + O * WEIGHTS.O + R * WEIGHTS.R,
    P,
    IP,
    O,
    R,
  };
}
function makeDisplayLabel(
  a: Partial<Agent>,
  active: number,
  weight: number,
  s: { P: number; IP: number; O: number; R: number }
) {
  return `${safeName(a)} — ${active} active (P:${s.P} | IP:${s.IP} | O:${
    s.O
  } | R:${s.R}) • W:${weight}`;
}
// OPTIMIZED: Removed N+1 query problem - was fetching each agent's tasks individually
// This was causing 10+ sequential API calls per page load, severely impacting performance
// Now agents are returned without individual load data for instant page loads
function enrichAgentsBasic(base: Agent[]): AgentWithLoad[] {
  // Sort by name only (no load data fetching)
  const enriched: AgentWithLoad[] = base.map((a) => ({
    ...a,
    byStatus: { pending: 0, in_progress: 0, overdue: 0, reassigned: 0 },
    activeCount: 0,
    weightedScore: 0,
    displayLabel: `${safeName(a)} — Available`,
  }));

  enriched.sort((x, y) => safeName(x).localeCompare(safeName(y)));
  return enriched;
}

/* ------------------- Category stats ------------------- */

type CategoryStats = {
  total: number;
  assigned: number;
  fullyAssigned: boolean;
  agents: Record<string, number>;
  dueMin?: string;
  dueMax?: string;
  allDueSame: boolean;
};

function buildCategoryStats(list: Task[] = []): CategoryStats {
  const res: CategoryStats = {
    total: 0,
    assigned: 0,
    fullyAssigned: false,
    agents: {},
    allDueSame: true,
  };

  for (const t of list) {
    res.total += 1;

    const agentId = (t as any).assignedToId as string | undefined;
    if (agentId) {
      res.assigned += 1;
      res.agents[agentId] = (res.agents[agentId] ?? 0) + 1;
    }

    const dueRaw = (t as any).dueDate;
    if (dueRaw) {
      const due = new Date(dueRaw);
      if (!isNaN(due.getTime())) {
        const iso = due.toISOString();
        if (!res.dueMin || new Date(iso) < new Date(res.dueMin))
          res.dueMin = iso;
        if (!res.dueMax || new Date(iso) > new Date(res.dueMax))
          res.dueMax = iso;
        if (res.dueMin && res.dueMax && res.dueMin !== res.dueMax)
          res.allDueSame = false;
      }
    }
  }

  res.fullyAssigned = res.total > 0 && res.assigned === res.total;
  return res;
}

type SimpleCategoryStats = { total: number; assigned: number };

// ✅ NEW: decide which UI category a task belongs to
function getUICategoryForTask(t: Task): string {
  const enumType = (t as any)?.templateSiteAsset?.type as string | undefined;

  // Asset Creation (from enum)
  if (["social_site", "web2_site", "other_asset"].includes(enumType ?? "")) {
    return "Asset Creation";
  }

  // Posting categories (from t.category.name)
  const catName = (t as any)?.category?.name as string | undefined;
  if (catName && (POSTING_CATEGORIES as readonly string[]).includes(catName)) {
    return catName;
  }

  // Fallback to existing enum->label map
  return mapSiteAssetTypeToCategory(enumType);
}

function buildStatsByCategory(
  list: Task[] = []
): Record<string, SimpleCategoryStats> {
  const map: Record<string, SimpleCategoryStats> = {};
  for (const t of list) {
    const label = getUICategoryForTask(t);
    if (!map[label]) map[label] = { total: 0, assigned: 0 };
    map[label].total += 1;
    if ((t as any)?.assignedToId) map[label].assigned += 1;
  }
  return map;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDaysSafe(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

/* =========================
   Component
   ========================= */

interface CategoryAssignment {
  taskId: string;
  agentId: string;
  assetType: string | undefined; // enum string for asset-creation; undefined for posting
}

type AssetCreationBuckets = {
  social_site: Task[];
  web2_site: Task[];
  other_asset: Task[];
};

// OPTIMIZATION (single-pass bucketing): reduce Asset Creation tasks in O(n) instead of 3 expensive filters per render.
function bucketAssetCreationTasks(list: Task[] = []): AssetCreationBuckets {
  return list.reduce<AssetCreationBuckets>(
    (acc, task) => {
      const type = (task as any)?.templateSiteAsset?.type;
      if (type === "web2_site") {
        acc.web2_site.push(task);
      } else if (type === "other_asset") {
        acc.other_asset.push(task);
      } else {
        acc.social_site.push(task);
      }
      return acc;
    },
    { social_site: [], web2_site: [], other_asset: [] }
  );
}
// ✅ SWR fetchers
const jsonFetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
};
const enrichedAgentsFetcher = async (teamId?: string) => {
  const url = teamId
    ? `/api/tasks/agents?teamId=${encodeURIComponent(teamId)}`
    : `/api/tasks/agents`;
  const baseAgents: Agent[] = await jsonFetcher(url);
  // ⚡ OPTIMIZED: Use basic enrichment (no individual fetches)
  return enrichAgentsBasic(baseAgents);
};

export default function TaskDistributionForClient() {
  const params = useParams<{ clientId: string }>();
  const clientId = params?.clientId;
  // OPTIMIZATION (React useTransition): smooth out category switches during heavy filtering.
  const [isCategoryPending, startCategoryTransition] = useTransition();
  // Client & tasks via SWR
  // OPTIMIZATION (compact API view): request distribution-only fields to shrink payload.
  const { data: client, isLoading: clientLoading } = useSWR<Client>(
    clientId ? `/api/clients/${clientId}?view=distribution` : null,
    jsonFetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000, refreshInterval: 60000 }
  );

  const {
    data: allTasks = [],
    isLoading: tasksLoading,
    mutate: mutateTasks,
  } = useSWR<Task[]>(
    clientId ? `/api/tasks/client/${clientId}` : null,
    jsonFetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000, refreshInterval: 60000 }
  );

  // ⚡ OPTIMIZED: Removed useState, using useMemo instead for better performance

  // ✅ Agent lists + source toggle via SWR
  const [agentSource, setAgentSource] = useState<"team" | "all">("team");
  const [selectedCategory, setSelectedCategory] =
    useState<string>("Graphics Design");

  const {
    data: teamAgents = [],
    isLoading: teamAgentsLoading,
    mutate: mutateTeamAgents,
  } = useSWR<AgentWithLoad[]>(
    clientId ? ["agents", "team", selectedCategory] : null,
    () => enrichedAgentsFetcher(teamIdForCategory(selectedCategory)),
    { revalidateOnFocus: false, dedupingInterval: 30000, refreshInterval: 60000 }
  );

  const {
    data: allAgents = [],
    isLoading: allAgentsLoading,
    mutate: mutateAllAgents,
  } = useSWR<AgentWithLoad[]>(
    clientId ? ["agents", "all"] : null,
    () => enrichedAgentsFetcher(undefined),
    { revalidateOnFocus: false, dedupingInterval: 30000, refreshInterval: 60000 }
  );

  const currentAgents = agentSource === "team" ? teamAgents : allAgents;

  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [selectedTasksOrder, setSelectedTasksOrder] = useState<string[]>([]);
  const [categoryAssignments, setCategoryAssignments] = useState<
    CategoryAssignment[]
  >([]);
  const [taskNotes, setTaskNotes] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  // OPTIMIZATION (virtual batching): progressively reveal tasks instead of dumping hundreds at once.
  const [visibleTaskBatches, setVisibleTaskBatches] = useState(1);

  // default category (now declared earlier to drive SWR key)
  const [categoryDueDate, setCategoryDueDate] = useState<Date>();
  const [duePickerOpen, setDuePickerOpen] = useState(false);

  // ✅ NEW: Reassign modal state at page level
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);

  // ⚡ OPTIMIZED: Use useMemo instead of useEffect + setState to prevent unnecessary re-renders
  // IMPORTANT: This must be declared BEFORE selectedTaskObjects that uses it
  const tasks = useMemo(() => {
    return (allTasks ?? []).filter(
      (t) => getUICategoryForTask(t) === selectedCategory
    );
  }, [allTasks, selectedCategory]);

  useEffect(() => {
    setVisibleTaskBatches(1);
  }, [selectedCategory, tasks.length]);

  // OPTIMIZATION (React useDeferredValue): postpone heavy task filtering updates to keep typing fluid.
  const deferredTasks = useDeferredValue(tasks);
  const visibleTasks = useMemo(
    () => deferredTasks.slice(0, visibleTaskBatches * TASK_BATCH_SIZE),
    [deferredTasks, visibleTaskBatches]
  );
  const remainingVirtualTasks = Math.max(
    deferredTasks.length - visibleTasks.length,
    0
  );
  const hasMoreTasks = remainingVirtualTasks > 0;
  const nextBatchSize = Math.min(remainingVirtualTasks, TASK_BATCH_SIZE);

  const handleLoadMoreTasks = useCallback(() => {
    setVisibleTaskBatches((prev) => prev + 1);
  }, []);

  // ✅ NEW: Get selected tasks as Task objects for modal
  const selectedTaskObjects = useMemo(() => {
    return tasks.filter((task) => selectedTasks.has(task.id));
  }, [tasks, selectedTasks]);

  // OPTIMIZATION (memoized payload): keep TaskTabs props stable to avoid unnecessary re-renders.
  const memoizedTaskAssignments = useMemo(
    () =>
      categoryAssignments.map((assignment) => ({
        taskId: assignment.taskId,
        agentId: assignment.agentId,
      })),
    [categoryAssignments]
  );

  // ✅ NEW: Handle reassign functionality at page level
  const handleReassign = async (taskIds: string[], newAgentId: string, dueDate?: Date) => {
    // Use the existing PUT endpoint for reassignments
    const response = await fetch("/api/tasks/distribute", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reassignments: taskIds.map((taskId) => ({
          taskId,
          toAgentId: newAgentId,
          reassignNotes: `Reassigned via modal - New due date: ${dueDate ? new Date(dueDate).toISOString() : 'No change'}`,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to reassign tasks");
    }

    const result = await response.json();
    
    // Refresh the data after reassignment
    await mutateTasks();
    
    return result;
  };

  // Refresh function to update data after unassign
  const refreshData = async () => {
    await mutateTasks();
    await mutateTeamAgents();
    await mutateAllAgents();
  };

  // Handle unassign functionality
  const handleUnassign = async (taskIds: string[]) => {
    try {
      // Use the existing PUT endpoint for reassignments with null agentId
      const response = await fetch("/api/tasks/distribute", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reassignments: taskIds.map((taskId) => ({
            taskId,
            toAgentId: null,
            reassignNotes: "Unassigned via Un-Assign button",
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to unassign tasks");
      }

      const result = await response.json();
      
      // Show success toast
      toast.success(`Successfully unassigned ${taskIds.length} task${taskIds.length > 1 ? 's' : ''}`);
      
      // Refresh the data after unassign
      await refreshData();
      
      return result;
    } catch (error) {
      // Show error toast
      toast.error(`Failed to unassign tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  };

  // -------- Derived / helpers --------

  const formatISO = (iso?: string) =>
    iso ? format(new Date(iso), "PPP") : undefined;

  // Buckets for Asset Creation only
  const categorizedTasksForAssetCreation = useMemo(() => {
    if (selectedCategory !== "Asset Creation") {
      return { social_site: [], web2_site: [], other_asset: [] };
    }
    return bucketAssetCreationTasks(visibleTasks);
  }, [selectedCategory, visibleTasks]);

  const getAgentName = (id: string | undefined) => {
    if (!id) return "Unassigned";
    const a = currentAgents.find((x) => (x as any).id === id);
    return (
      a?.name ||
      `${(a as any)?.firstName ?? ""} ${(a as any)?.lastName ?? ""}`.trim() ||
      "Unknown"
    );
  };

  // OPTIMIZATION (useTransition): category switches happen inside a transition so React keeps the UI responsive while SWR + filtering update.
  const handleCategoryChange = useCallback(
    (label: string) => {
      startCategoryTransition(() => {
        setSelectedCategory(label);
        setCategoryAssignments([]);
        setSelectedTasks(new Set());
        setSelectedTasksOrder([]);
        setCategoryDueDate(undefined);
        setVisibleTaskBatches(1);
      });
      setDuePickerOpen(false);
      void mutateTeamAgents();
    },
    [mutateTeamAgents, startCategoryTransition]
  );

  const handleTaskSelection = useCallback((taskId: string, checked: boolean) => {
    setSelectedTasks((prev) => {
      const newSet = new Set(prev);
      if (checked) newSet.add(taskId);
      else {
        newSet.delete(taskId);
        setCategoryAssignments((assignments) =>
          assignments.filter((assignment) => assignment.taskId !== taskId)
        );
      }
      return newSet;
    });

    setSelectedTasksOrder((prev) =>
      checked
        ? prev.includes(taskId)
          ? prev
          : [...prev, taskId]
        : prev.filter((id) => id !== taskId)
    );
  }, []);

  const handleSelectAllTasks = useCallback((taskIds: string[], checked: boolean) => {
    if (checked) {
      setSelectedTasks(new Set(taskIds));
      setSelectedTasksOrder(taskIds);
      toast.info(`Selected ${taskIds.length} tasks from current view`);
    } else {
      const currentViewTaskIds = new Set(taskIds);
      const preserved = Array.from(selectedTasks).filter(
        (id) => !currentViewTaskIds.has(id)
      );
      setSelectedTasks(new Set(preserved));
      setSelectedTasksOrder((prev) =>
        prev.filter((id) => !currentViewTaskIds.has(id))
      );
      setCategoryAssignments((assignments) =>
        assignments.filter((a) => !currentViewTaskIds.has(a.taskId))
      );
    }
  }, [selectedTasks]);

  const handleTaskAssignment = useCallback((
    taskId: string,
    agentId: string,
    isMultipleSelected: boolean,
    isFirstSelectedTask: boolean
  ) => {
    const task = tasks.find((t) => t.id === taskId);
    const assetType = (task as any)?.templateSiteAsset?.type as
      | string
      | undefined;

    // bulk apply if multiple selected
    if (isMultipleSelected && isFirstSelectedTask) {
      const selectedArray = Array.from(selectedTasks);
      const newAssignments: CategoryAssignment[] = selectedArray.map((id) => {
        const t = tasks.find((x) => x.id === id);
        return {
          taskId: id,
          agentId,
          assetType: (t as any)?.templateSiteAsset?.type,
        };
      });

      setCategoryAssignments((prev) => {
        const filtered = prev.filter((a) => !selectedTasks.has(a.taskId));
        return [...filtered, ...newAssignments];
      });

      setSelectedTasks(new Set());
      setSelectedTasksOrder([]);
      toast.success(`Assigned ${selectedArray.length} tasks to agent`);
    } else {
      setCategoryAssignments((prev) => {
        const filtered = prev.filter((a) => a.taskId !== taskId);
        if (agentId) return [...filtered, { taskId, agentId, assetType }];
        return filtered;
      });

      setSelectedTasks(new Set());
      setSelectedTasksOrder([]);
    }
  }, [selectedTasks, tasks]);

  const handleNoteChange = useCallback((taskId: string, note: string) => {
    setTaskNotes((prev) => ({ ...prev, [taskId]: note }));
  }, []);

  const submitTaskDistribution = async () => {
    if (categoryAssignments.length === 0) {
      toast.warning("⚠️ No Assignments", {
        description:
          "Please assign at least one task to an agent before distributing",
      });
      return;
    }

    setSubmitting(true);
    try {
      // Only compute a due date if user selected one (optional)
      let formattedDueDate: string | undefined = undefined;
      if (categoryDueDate) {
        const endOfDay = new Date(categoryDueDate);
        endOfDay.setHours(23, 59, 59, 999);
        formattedDueDate = endOfDay.toISOString();
      }

      const requestBody = {
        clientId,
        category: selectedCategory, // optional logging context
        assignments: categoryAssignments.map((assignment) => ({
          taskId: assignment.taskId,
          agentId: assignment.agentId,
          note: taskNotes[assignment.taskId] || "",
          dueDate: formattedDueDate,
        })),
      };

      const response = await fetch("/api/tasks/distribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("🎉 Tasks Distributed Successfully!", {
          description: `${categoryAssignments.length} tasks have been assigned for ${selectedCategory}. Notifications sent.`,
          duration: 5000,
        });

        // ✅ Revalidate tasks and both agent lists via SWR
        await Promise.all([
          mutateTasks(),
          mutateTeamAgents(),
          mutateAllAgents(),
        ]);

        setCategoryAssignments([]);
        setSelectedTasks(new Set());
        setSelectedTasksOrder([]);
        setCategoryDueDate(undefined);
      } else {
        console.error("[category] API error response:", result);
        throw new Error(result.message || "Failed to distribute tasks");
      }
    } catch (error) {
      console.error("[category] Error distributing tasks:", error);
      toast.error("❌ Task Distribution Failed", {
        description: "Please try again or contact support.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // -------- Render --------

  const stats = buildCategoryStats(tasks);
  const statsByCategory = useMemo(
    () => buildStatsByCategory(allTasks),
    [allTasks]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-100 to-zinc-100">
      <div className="mx-auto">
        <Card className="shadow-2xl border-0 bg-gradient-to-br from-white via-gray-50 to-slate-50 overflow-hidden">
          <CardHeader className="relative overflow-hidden bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/40 text-slate-800 p-2 md:p-4 rounded-t-2xl border-b border-slate-100/80 backdrop-blur-sm">
            {/* Ambient lighting effects */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute top-0 left-0 w-72 h-72 bg-gradient-radial from-blue-400/8 via-transparent to-transparent rounded-full blur-3xl" />
              <div className="absolute top-0 right-0 w-96 h-48 bg-gradient-radial from-indigo-400/6 via-transparent to-transparent rounded-full blur-3xl" />
            </div>

            {/* Main content */}
            <div className="relative z-10">
              {/* Header section with enhanced spacing */}
              <div className="flex items-start justify-between gap-4 mb-6">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-slate-800 via-blue-700 to-indigo-700 bg-clip-text text-transparent tracking-tight leading-tight mb-2">
                    Category-Based Task Distribution
                  </CardTitle>
                </div>

                {/* Enhanced icon container */}
                <div className="group flex items-center justify-center w-12 h-12 md:w-12 md:h-12 rounded-2xl bg-gradient-to-br from-blue-50 via-white to-indigo-50 ring-1 ring-blue-200/50 shadow-lg shadow-blue-100/50 transition-all duration-300 hover:shadow-xl hover:shadow-blue-200/60 hover:scale-105 shrink-0">
                  <Repeat
                    className="h-6 w-6 md:h-7 md:w-7 text-blue-600 transition-all duration-300 group-hover:rotate-180"
                    aria-hidden
                  />
                </div>
              </div>

              {/* Client section with improved layout */}
              {client && (
                <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-white/60 via-white/40 to-white/60 backdrop-blur-sm border border-white/50 shadow-sm transition-all duration-300 hover:shadow-md hover:bg-white/70">
                  {/* Enhanced avatar */}
                  <div className="relative shrink-0">
                    <Avatar className="h-12 w-12 md:h-14 md:w-14 ring-2 ring-white shadow-md transition-all duration-300 hover:ring-4 hover:ring-blue-200/50">
                      {client.avatar ? (
                        <AvatarImage
                          src={client.avatar}
                          alt={client.name || "Client avatar"}
                          className="transition-all duration-300 hover:scale-110"
                        />
                      ) : (
                        <AvatarFallback
                          className="text-white text-sm md:text-base font-bold transition-all duration-300 hover:scale-110"
                          style={{
                            backgroundColor: nameToColor(
                              client.name || client.id
                            ),
                          }}
                        >
                          {getInitialsFromName(client.name || client.id)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    {client.status === "active" && (
                      <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full ring-2 ring-white shadow-sm animate-pulse" />
                    )}
                  </div>

                  {/* Client info with better typography */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <h3 className="text-lg md:text-xl font-bold text-slate-900 truncate">
                        {client.name || "Unnamed Client"}
                      </h3>
                      {client.status === "active" && (
                        <Star
                          className="h-4 w-4 text-teal-500 shrink-0"
                          fill="currentColor"
                        />
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {/* Company info */}
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Building2 className="h-4 w-4 text-slate-500 shrink-0" />
                        <span className="text-sm font-medium truncate max-w-[200px]">
                          {client.company || "No company"}
                        </span>
                      </div>

                      {/* Status and package badges */}
                      <div className="flex items-center gap-2">
                        {client.status && (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200 hover:scale-105",
                              client.status === "active"
                                ? "bg-green-100 text-green-700 ring-1 ring-green-200"
                                : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                            )}
                          >
                            <span
                              className={cn(
                                "w-1.5 h-1.5 rounded-full mr-1.5",
                                client.status === "active"
                                  ? "bg-green-500"
                                  : "bg-slate-400"
                              )}
                            />
                            {client.status.charAt(0).toUpperCase() +
                              client.status.slice(1)}
                          </span>
                        )}

                        {client.package?.name && (
                          <span
                            title={client.package.name}
                            className="inline-flex items-center rounded-full bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200 px-3 py-1 text-xs font-semibold transition-all duration-200 hover:scale-105 hover:bg-indigo-200"
                          >
                            <span className="mr-1.5">📦</span>
                            <span className="truncate max-w-[120px] md:max-w-[160px]">
                              {client.package.name}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Subtle bottom accent */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-300/60 to-transparent" />
          </CardHeader>

          <CardContent className="p-2 md:px-4 lg:px-4 space-y-8">
            {/* CATEGORY CONTROLS & SUMMARY */}
            <section
              aria-labelledby="category-assignment-heading"
              className="space-y-4"
            >
              <div className="border rounded-2xl p-6 md:p-7 bg-gradient-to-br from-purple-50 to-white border-purple-200/70">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Category Selector */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-700">
                        Select Category to Assign
                      </label>
                      {isCategoryPending && (
                        <span className="text-xs text-slate-500 animate-pulse">
                          Updating&hellip;
                        </span>
                      )}
                    </div>
                    <Select
                      value={selectedCategory}
                      onValueChange={handleCategoryChange}
                    >
                      <SelectTrigger
                        className="w-full h-11 rounded-xl border-slate-300"
                        aria-busy={isCategoryPending}
                      >
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>

                      <SelectContent className="rounded-xl shadow-lg border border-slate-200 bg-white">
                        {CATEGORY_LABELS.map((label) => {
                          const s = statsByCategory[label];
                          const fully =
                            !!s && s.total > 0 && s.assigned === s.total;
                          const teamName = teamNameForCategory(label);

                          return (
                            <SelectItem
                              key={label}
                              value={label}
                              className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-800">
                                  {label}
                                </span>
                                <span className="text-[10px] uppercase tracking-wide bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
                                  {teamName}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {s ? (
                                  fully ? (
                                    <span className="flex items-center text-emerald-600 text-xs font-semibold">
                                      <CheckCircle2 className="h-4 w-4 mr-1" />
                                      All Assigned
                                    </span>
                                  ) : (
                                    <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                                      {s.assigned}/{s.total}
                                    </span>
                                  )
                                ) : (
                                  <span className="text-xs text-slate-400 italic">
                                    No tasks
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Due Date */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">
                      Due Date for All Tasks in {selectedCategory}{" "}
                      <span className="text-green-500">( Optional )</span>
                    </label>
                    <Popover
                      open={duePickerOpen}
                      onOpenChange={setDuePickerOpen}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full h-10 justify-start text-left font-medium rounded-xl border-slate-300",
                            !categoryDueDate && "text-muted-foreground"
                          )}
                          aria-label="Open date picker"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {categoryDueDate
                            ? format(categoryDueDate, "PPP")
                            : "Select due date"}
                        </Button>
                      </PopoverTrigger>

                      <PopoverContent
                        align="start"
                        sideOffset={8}
                        className="p-0 w-[300px] overflow-hidden rounded-2xl border border-slate-200 shadow-2xl bg-white"
                      >
                        <div className="px-3 py-2 bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500">
                          <div className="text-[10px] uppercase tracking-wide text-white/80">
                            Due date
                          </div>
                          <div className="text-lg font-semibold text-white leading-5">
                            {categoryDueDate
                              ? format(categoryDueDate, "EEE, MMM d")
                              : "Pick a date"}
                          </div>
                        </div>

                        <div className="p-2 flex justify-center">
                          <Calendar
                            mode="single"
                            selected={categoryDueDate}
                            onSelect={(d) => {
                              if (!d) return;
                              d.setHours(0, 0, 0, 0);
                              setCategoryDueDate(d);
                              setDuePickerOpen(false);
                            }}
                            disabled={(date) => date < startOfToday()}
                            initialFocus
                            className="rounded-lg"
                          />
                        </div>

                        <div className="px-2 py-2 border-t bg-white flex flex-wrap gap-1.5">
                          <button
                            className="h-7 px-3 text-xs rounded-full bg-slate-100 hover:bg-slate-200 text-cyan-600 font-semibold"
                            onClick={() => {
                              const d = startOfToday();
                              setCategoryDueDate(d);
                              setDuePickerOpen(false);
                            }}
                          >
                            Today
                          </button>
                          <button
                            className="h-7 px-3 text-xs rounded-full bg-slate-100 hover:bg-slate-200 text-cyan-600 font-semibold"
                            onClick={() => {
                              const d = addDaysSafe(new Date(), 1);
                              setCategoryDueDate(d);
                              setDuePickerOpen(false);
                            }}
                          >
                            Tomorrow
                          </button>
                          <button
                            className="h-7 px-3 text-xs rounded-full bg-slate-100 hover:bg-slate-200 text-cyan-600 font-semibold"
                            onClick={() => {
                              const d = addDaysSafe(new Date(), 7);
                              setCategoryDueDate(d);
                              setDuePickerOpen(false);
                            }}
                          >
                            +7 days
                          </button>

                          <div className="flex-1" />
                          <button
                            className="h-7 px-3 text-xs bg-slate-100 rounded-full text-cyan-600 hover:bg-slate-100 font-semibold"
                            onClick={() => {
                              setCategoryDueDate(undefined);
                              setDuePickerOpen(false);
                            }}
                          >
                            Clear
                          </button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <h3
                  id="category-assignment-heading"
                  className="text-lg md:text-xl font-semibold text-slate-800 mb-4"
                >
                  {selectedCategory} Assignment
                </h3>

                {/* Summary */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/70 rounded-2xl p-2 md:p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-base md:text-lg font-semibold text-blue-900">
                      Assignment Summary
                    </h4>
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-full px-3 py-1 text-xs",
                        stats.fullyAssigned
                          ? "bg-green-100 text-green-800 border-green-200"
                          : "bg-blue-100 text-blue-800 border-blue-200"
                      )}
                      aria-live="polite"
                    >
                      {`${stats.assigned}/${stats.total} assigned`}
                      {stats.fullyAssigned ? " • All Set ✓" : ""}
                    </Badge>
                  </div>

                  {(categoryDueDate || categoryAssignments.length > 0) && (
                    <div className="mb-4 p-3 bg-cyan-50 border border-cyan-200 rounded-xl">
                      <p className="text-sm text-cyan-900">
                        {categoryDueDate && (
                          <>
                            <CalendarIcon className="inline h-4 w-4 mr-1" />
                            Planned due date:{" "}
                            <strong>{format(categoryDueDate, "PPP")}</strong>
                          </>
                        )}
                        {categoryAssignments.length > 0 && (
                          <>
                            {categoryDueDate ? " • " : ""}
                            Pending to distribute now:{" "}
                            <strong>{categoryAssignments.length}</strong>{" "}
                            {categoryAssignments.length > 1 ? "tasks" : "task"}
                          </>
                        )}
                      </p>
                    </div>
                  )}

                  {/* Distribute button */}
                  <div className="mt-2">
                    <Button
                      onClick={submitTaskDistribution}
                      disabled={submitting || categoryAssignments.length === 0}
                      className={cn(
                        "w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-sm hover:shadow-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-600",
                        (submitting || categoryAssignments.length === 0) &&
                          "opacity-60 cursor-not-allowed"
                      )}
                      aria-disabled={
                        submitting || categoryAssignments.length === 0
                      }
                    >
                      {submitting ? (
                        <div className="flex items-center gap-2">
                          <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                          Distributing Tasks...
                        </div>
                      ) : (
                        `Distribute ${categoryAssignments.length} Task${
                          categoryAssignments.length !== 1 ? "s" : ""
                        } for ${selectedCategory}`
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </section>

            {/* TASKS AREA */}
            {tasks.length > 0 ? (
              <section aria-labelledby="tasks-heading" className="space-y-8">
                <h3 id="tasks-heading" className="sr-only">
                  Tasks
                </h3>

                {/* ...existing imports and code above... */}

                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <LoadingSpinner />
                  </div>
                ) : selectedCategory === "Asset Creation" ? (
                  // Tabs (Asset Creation)
                  <TaskTabs
                    categorizedTasks={categorizedTasksForAssetCreation}
                    // NEW: pass both lists
                    teamAgents={teamAgents}
                    allAgents={allAgents}
                    agents={currentAgents}
                    selectedTasks={selectedTasks}
                    selectedTasksOrder={selectedTasksOrder}
                    taskAssignments={memoizedTaskAssignments}
                    taskNotes={taskNotes}
                    viewMode={viewMode}
                    onTaskSelection={handleTaskSelection}
                    onSelectAllTasks={handleSelectAllTasks}
                    onTaskAssignment={handleTaskAssignment}
                    onNoteChange={handleNoteChange}
                    onViewModeChange={setViewMode}
                    // ✅ NEW: Modal props from parent
                    isReassignModalOpen={isReassignModalOpen}
                    onReassignModalOpen={setIsReassignModalOpen}
                    onReassign={handleReassign}
                    onUnassign={handleUnassign}
                    onRefresh={refreshData}
                    selectedTaskObjects={selectedTaskObjects}
                  />
                ) : (
                  // Single-tab view for posting/new/other categories
                  <TaskTabs
                    singleTabTitle={selectedCategory}
                    singleTabTasks={visibleTasks}
                    // NEW: pass both lists
                    teamAgents={teamAgents}
                    allAgents={allAgents}
                    agents={currentAgents}
                    selectedTasks={selectedTasks}
                    selectedTasksOrder={selectedTasksOrder}
                    taskAssignments={memoizedTaskAssignments}
                    taskNotes={taskNotes}
                    viewMode={viewMode}
                    onTaskSelection={handleTaskSelection}
                    onSelectAllTasks={handleSelectAllTasks}
                    onTaskAssignment={handleTaskAssignment}
                    onNoteChange={handleNoteChange}
                    onViewModeChange={setViewMode}
                    // ✅ NEW: Pass modal handlers from parent
                    isReassignModalOpen={isReassignModalOpen}
                    onReassignModalOpen={setIsReassignModalOpen}
                    onReassign={handleReassign}
                    onUnassign={handleUnassign}
                    onRefresh={refreshData}
                    selectedTaskObjects={selectedTaskObjects}
                  />
                )}
                {!loading && hasMoreTasks && (
                  <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300/70 p-4 bg-white/70">
                    <p className="text-xs text-slate-600">
                      Showing {visibleTasks.length} of {deferredTasks.length} tasks
                    </p>
                    <Button
                      variant="outline"
                      onClick={handleLoadMoreTasks}
                      className="rounded-full px-6"
                    >
                      {/* OPTIMIZATION (virtual batching control): manual pager keeps DOM nodes capped while still letting the user continue */}
                      Load {nextBatchSize} more task
                      {nextBatchSize !== 1 ? "s" : ""} (
                      {remainingVirtualTasks} left)
                    </Button>
                  </div>
                )}
              </section>
            ) : (
              // EMPTY STATE
              <section
                aria-live="polite"
                className="rounded-2xl border border-yellow-200 bg-yellow-50 p-6 text-center"
              >
                <h3 className="text-base md:text-lg font-semibold text-yellow-900 mb-1.5">
                  No Tasks Available for {selectedCategory}
                </h3>
                <p className="text-sm text-yellow-800/90">
                  Either all tasks in this category are completed or none exist
                  yet.
                </p>
              </section>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ✅ NEW: Reassign Modal at page level */}
      <ReassignModal
        isOpen={isReassignModalOpen}
        onClose={() => setIsReassignModalOpen(false)}
        selectedTasks={selectedTaskObjects}
        agents={allAgents}
        onReassign={handleReassign}
      />
    </div>
  );
}
