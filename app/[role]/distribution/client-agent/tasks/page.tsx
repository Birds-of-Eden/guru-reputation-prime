// app/[role]/distribution/client-agent/tasks/page.tsx

"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import useSWR from "swr";
import { useSearchParams, useRouter } from "next/navigation";
import { useRoleSegment } from "@/lib/hooks/use-role-segment";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  LayoutList,
  Search,
  Clock,
  ChevronRight,
  ArrowLeft,
  CalendarDays,
  Timer,
  Link2,
  User,
  Bookmark,
  ClipboardCopy,
  Eye,
  EyeOff,
  Filter,
  BarChart3,
  Hash,
  ListTodo,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getInitialsFromName, nameToColor } from "@/utils/avatar";
import { toast } from "sonner";
import { Building2, Package } from "lucide-react";
import { BackgroundGradient } from "@/components/ui/background-gradient";
import { CreateNewTaskModal } from "@/components/task-distribution/CreateNewTask";

/* =========================
   Types (w/ richer fields)
   ========================= */
type Task = {
  id: string;
  name: string;
  status:
    | "pending"
    | "in_progress"
    | "completed"
    | "overdue"
    | "cancelled"
    | "reassigned"
    | "qc_approved";
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string | null;
  createdAt: string;
  idealDurationMinutes: number | null;

  completionLink: string | null;
  username: string | null;
  email?: string | null; // <- ensure your API includes these
  password?: string | null; // <-
  notes: string | null;

  clientId: string;
  category?: { name: string } | null;
  assignedTo?: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
};

type Summary = {
  total: number;
  countsByStatus: Record<string, number>;
  countsByPriority: Record<string, number>;
  countsByCategory: Record<string, number>;
};

type ClientHeader = {
  id: string;
  name: string;
  company: string | null;
  avatar: string | null;
  status: string | null;
  package: { name: string | null } | null;
};

/** Small type for section groups keyed by due date */
type CycleGroup = { key: string; items: Task[]; label: string };

/* =========================
   Helpers
   ========================= */

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

/** Format either an ISO datetime or a YYYY-MM-DD string as "October 25, 2025" */
function formatDateLong(input?: string | null) {
  if (!input) return "—";
  // Accept both full ISO ("2025-10-25T12:34:56Z") and date-only ("2025-10-25")
  const ymd = /^\d{4}-\d{2}-\d{2}$/.test(input) ? input : dateOnlyISO(input);
  if (!ymd) return "—";
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d); // local date
  return dt.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Return a YYYY-MM-DD date from an ISO string (or null). */
function dateOnlyISO(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`; // YYYY-MM-DD
}

/** Pick the cycle’s representative date:
 *  - most frequent dueDate date (YYYY-MM-DD)
 *  - fallback to createdAt date
 *  - tie-breaker: earliest date
 */
function pickCycleDateISO(items: Task[]): string | null {
  const counts: Record<string, number> = {};
  for (const t of items) {
    const base = dateOnlyISO(t.dueDate) ?? dateOnlyISO(t.createdAt);
    if (!base) continue;
    counts[base] = (counts[base] ?? 0) + 1;
  }
  const keys = Object.keys(counts);
  if (!keys.length) return null;
  keys.sort((a, b) => counts[b] - counts[a] || a.localeCompare(b)); // by freq desc, then earliest
  return keys[0]; // YYYY-MM-DD
}

/** Extract trailing cycle number: “… -1” / “…-1” / “… – 1” etc. */
function extractCycleNumber(name: string): number | null {
  const m = String(name)
    .trim()
    .match(/(?:-|—|\u2013)\s*(\d+)\s*$/);
  if (m && m[1]) return Number(m[1]);
  const m2 = String(name)
    .trim()
    .match(/(?:^|\s)(\d+)$/);
  if (m2 && m2[1]) return Number(m2[1]);
  return null;
}

async function copyToClipboard(v?: string | null, label?: string) {
  if (!v) return;
  try {
    await navigator.clipboard.writeText(v);
    toast.success(label ?? "Copied");
  } catch {
    toast.error("Copy failed");
  }
}

/* Status / priority / category color helpers */
const statusColor = (s: Task["status"]) =>
  ({
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    in_progress: "bg-sky-100 text-sky-800 border-sky-200",
    completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
    overdue: "bg-rose-100 text-rose-800 border-rose-200",
    cancelled: "bg-slate-100 text-slate-700 border-slate-200",
    reassigned: "bg-purple-100 text-purple-800 border-purple-200",
    qc_approved: "bg-indigo-100 text-indigo-800 border-indigo-200",
  }[s] || "bg-slate-100 text-slate-700 border-slate-200");

const priorityColor = (p: Task["priority"]) =>
  ({
    low: "bg-slate-100 text-slate-700 border-slate-200",
    medium: "bg-blue-100 text-blue-800 border-blue-200",
    high: "bg-orange-100 text-orange-800 border-orange-200",
    urgent: "bg-red-100 text-red-800 border-red-200",
  }[p] || "bg-slate-100 text-slate-700 border-slate-200");

const categoryColor = (c?: string) =>
  ({
    "Social Activity": "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
    "Blog Posting": "bg-cyan-100 text-cyan-800 border-cyan-200",
    "Social Communication": "bg-indigo-100 text-indigo-800 border-indigo-200",
    "Content Writing": "bg-emerald-100 text-emerald-800 border-emerald-200",
    "Guest Posting": "bg-rose-100 text-rose-800 border-rose-200",
    "Content Studio": "bg-violet-100 text-violet-800 border-violet-200",
    Backlinks: "bg-amber-100 text-amber-800 border-amber-200",
    "Completed Communication": "bg-slate-100 text-slate-800 border-slate-200",
    "YouTube Video Optimization": "bg-red-100 text-red-800 border-red-200",
    Monitoring: "bg-teal-100 text-teal-800 border-teal-200",
    "Review Removal": "bg-lime-100 text-lime-800 border-lime-200",
    "Summary Report": "bg-pink-100 text-pink-800 border-pink-200",
  }[c ?? ""] || "bg-slate-100 text-slate-700 border-slate-200");

/* Lighter cycle header gradients */
const cycleGrad = (n: number) => {
  const palette = [
    "from-indigo-100 via-fuchsia-100 to-cyan-100",
    "from-emerald-100 via-teal-100 to-cyan-100",
    "from-rose-100 via-orange-100 to-amber-100",
    "from-blue-100 via-violet-100 to-pink-100",
  ];
  return palette[(n - 1) % palette.length];
};

export default function CreatedTasksPage() {
  const router = useRouter();
  const params = useSearchParams();
  const roleSegment = useRoleSegment();
  const distributionBasePath = `/${roleSegment}/distribution/client-agent`;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  // UI State
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [sort, setSort] = useState<"dueAsc" | "dueDesc" | "createdDesc">(
    "dueAsc"
  );

  const [showPasswordIds, setShowPasswordIds] = useState<
    Record<string, boolean>
  >({});
  const [expandedCycles, setExpandedCycles] = useState<Record<string, boolean>>(
    {}
  );
  const cyclesNavRef = useRef<HTMLDivElement | null>(null);

  const [client, setClient] = useState<ClientHeader | null>(null);

  // Modal state for creating manual tasks
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);

  // incoming client selection via query param
  const clientId = params.get("clientId") ?? "";

  const fetcher = async (url: string) => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
    return res.json();
  };

  // Debounced search
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  // SWR for tasks list + summary
  const tasksKey = useMemo(() => {
    const qs = new URLSearchParams();
    if (clientId) qs.set("clientId", clientId);
    if (debouncedQ) qs.set("q", debouncedQ);
    if (status !== "all") qs.set("status", status);
    if (priority !== "all") qs.set("priority", priority);
    if (category !== "all") qs.set("category", category);
    return `/api/tasks/created?${qs.toString()}`;
  }, [clientId, debouncedQ, status, priority, category]);

  const { data: tasksResp, isLoading: loading, error, mutate } = useSWR(
    tasksKey,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000, refreshInterval: 60000 }
  );

  useEffect(() => {
    if (!tasksResp) return;
    setTasks(Array.isArray(tasksResp.tasks) ? tasksResp.tasks : []);
    setSummary(tasksResp.summary || null);
    if (clientId) {
      const firstWithClient = (tasksResp.tasks || []).find((t: any) => t.client)?.client;
      if (firstWithClient) {
        setClient({
          id: firstWithClient.id,
          name: firstWithClient.name ?? "",
          company: firstWithClient.company ?? null,
          avatar: firstWithClient.avatar ?? null,
          status: firstWithClient.status ?? null,
          package: firstWithClient.package ? { name: firstWithClient.package.name ?? null } : null,
        });
      }
    }
  }, [tasksResp, clientId]);

  // Fallback client header via SWR if not present from tasks
  const { data: clientFromApi } = useSWR<ClientHeader | null>(
    clientId && !client ? `/api/clients/${clientId}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );
  useEffect(() => {
    if (clientFromApi && !client) {
      setClient({
        id: clientFromApi.id,
        name: clientFromApi.name,
        company: clientFromApi.company,
        avatar: clientFromApi.avatar,
        status: clientFromApi.status,
        package: clientFromApi.package,
      });
    }
  }, [clientFromApi, client]);

  useEffect(() => {
    // re-derive sorted groups when filters change (SWR handles data)
  }, [q, status, priority, category, sort]);

  /* ===== Sort then Group By Cycle ===== */
  const sortedTasks = useMemo(() => {
    const copy = [...tasks];
    if (sort === "dueAsc") {
      copy.sort(
        (a, b) =>
          (new Date(a.dueDate ?? 0).getTime() || 0) -
          (new Date(b.dueDate ?? 0).getTime() || 0)
      );
    } else if (sort === "dueDesc") {
      copy.sort(
        (a, b) =>
          (new Date(b.dueDate ?? 0).getTime() || 0) -
          (new Date(a.dueDate ?? 0).getTime() || 0)
      );
    } else {
      copy.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
    return copy;
  }, [tasks, sort]);

  const cycles = useMemo<CycleGroup[]>(() => {
    // Group by exact due date (YYYY-MM-DD). Preserve task order from sortedTasks
    const map = new Map<string, Task[]>();
    for (const t of sortedTasks) {
      const d = dateOnlyISO(t.dueDate) ?? "No Due Date";
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(t);
    }

    // Sort sections by date asc; place "No Due Date" last
    const keys = Array.from(map.keys()).sort((a, b) => {
      if (a === "No Due Date") return 1;
      if (b === "No Due Date") return -1;
      return a.localeCompare(b);
    });

    const groups: CycleGroup[] = keys.map((k) => {
      const items = map.get(k)!;
      const label = k === "No Due Date" ? "No Due Date" : formatDateLong(k);
      return { key: k, items, label };
    });

    return groups;
  }, [sortedTasks]);

  const allCycleLabels = cycles.map((c) => c.label);

useEffect(() => {
  setExpandedCycles((prev) => {
    if (Object.keys(prev).length) return prev;

    const init: Record<string, boolean> = {};
    cycles.forEach((c) => {
      init[c.key] = false; // ✅ all collapsed initially
    });

    return init;
  });
}, [cycles]);

  const toggleCycle = (key: string) =>
    setExpandedCycles((s) => ({ ...s, [key]: !s[key] }));

  const goBack = () => router.push(distributionBasePath);

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-cyan-50">
      <div>
        {/* Lighter Header */}
        <Card className="border-0 shadow-2xl overflow-hidden bg-white/90 backdrop-blur">
          <CardHeader className="relative text-slate-800 border-b border-slate-200/60 bg-sky-50">
            <div className="p-6">
              {/* Top-left Back button */}
              <div className="mb-4">
                <Button
                  variant="ghost"
                  onClick={goBack}
                  className="h-9 px-3 -ml-2 text-slate-700 hover:bg-slate-100"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </div>

              {/* Client information (below back button) */}
              {client && (
                <div className="flex items-start gap-4 mb-4">
                  <Avatar className="h-14 w-14 ring-2 ring-slate-200">
                    {client.avatar ? (
                      <AvatarImage src={client.avatar} alt={client.name} />
                    ) : (
                      <AvatarFallback
                        className="text-white font-semibold"
                        style={{ backgroundColor: nameToColor(client.name) }}
                      >
                        {getInitialsFromName(client.name)}
                      </AvatarFallback>
                    )}
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">
                        {client.name}
                      </h2>

                      {client.status && (
                        <Badge
                          variant="outline"
                          className={`rounded-full text-xs border ${
                            client.status === "active"
                              ? "text-emerald-700 border-emerald-300"
                              : "text-slate-600 border-slate-300"
                          }`}
                        >
                          {client.status}
                        </Badge>
                      )}

                      {client.package?.name && (
                        <Badge
                          variant="outline"
                          className="rounded-full text-xs border border-indigo-300 text-indigo-700"
                        >
                          <Package className="h-3 w-3 mr-1" />
                          {client.package.name}
                        </Badge>
                      )}
                    </div>

                    <div className="mt-1.5 text-sm text-slate-600 flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-slate-400" />
                      <span className="truncate">
                        {client.company || "No company"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                {/* Title & subtitle */}
                <div className="space-y-1">
                  <CardTitle className="text-3xl font-bold flex items-center gap-3 text-slate-800">
                    <div className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center">
                      <LayoutList className="h-6 w-6 text-slate-700" />
                    </div>
                    Created Tasks — Cycle View
                  </CardTitle>
                </div>
                <div
                  className="flex items-center gap-2 p-4 font-bold text-violet-50 cursor-pointer"
                  onClick={() => setIsCreateTaskModalOpen(true)}
                >
                  <BackgroundGradient className="flex items-center gap-2 p-4">
                    <ListTodo />
                    Create Tasks Manually
                  </BackgroundGradient>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {/* Top Filters */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search tasks, notes, usernames, links…"
                  className="pl-9 h-11 rounded-xl"
                />
              </div>

              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="qc_approved">QC Approved</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="reassigned">Reassigned</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>

              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Social Activity">
                    Social Activity
                  </SelectItem>
                  <SelectItem value="Blog Posting">Blog Posting</SelectItem>
                  <SelectItem value="Social Communication">
                    Social Communication
                  </SelectItem>
                  <SelectItem value="Content Writing">
                    Content Writing
                  </SelectItem>
                  <SelectItem value="Guest Posting">Guest Posting</SelectItem>
                  <SelectItem value="Content Studio">Content Studio</SelectItem>
                  <SelectItem value="Backlinks">Backlinks</SelectItem>
                  <SelectItem value="Completed Communication">
                    Completed Communication
                  </SelectItem>
                  <SelectItem value="YouTube Video Optimization">
                    YouTube Video Optimization
                  </SelectItem>
                  <SelectItem value="Monitoring">Monitoring</SelectItem>
                  <SelectItem value="Review Removal">Review Removal</SelectItem>
                  <SelectItem value="Summary Report">Summary Report</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Summary Widgets */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <Card className="rounded-xl border-2 border-indigo-100 bg-indigo-50/60">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm text-indigo-700">Total Tasks</div>
                    <div className="text-2xl font-bold text-indigo-900">
                      {summary?.total ?? (loading ? "…" : 0)}
                    </div>
                  </div>
                  <ListTodo className="h-10 w-10 text-indigo-600" />
                </CardContent>
              </Card>

              <Card className="rounded-xl border-2 border-fuchsia-100 bg-fuchsia-50/60">
                <CardContent className="p-4">
                  <div className="text-sm text-fuchsia-700 mb-2 flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    By Status
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {summary ? (
                      Object.entries(summary.countsByStatus).map(([s, n]) => (
                        <Badge
                          key={s}
                          variant="outline"
                          className="bg-white text-fuchsia-800 border-fuchsia-200"
                        >
                          {s.replaceAll("_", " ")}:{" "}
                          <span className="ml-1 font-semibold">{n}</span>
                        </Badge>
                      ))
                    ) : (
                      <span className="text-fuchsia-700/70">—</span>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl border-2 border-cyan-100 bg-cyan-50/60">
                <CardContent className="p-4">
                  <div className="text-sm text-cyan-700 mb-2 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    By Priority
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {summary ? (
                      Object.entries(summary.countsByPriority).map(([p, n]) => (
                        <Badge
                          key={p}
                          variant="outline"
                          className="bg-white text-cyan-800 border-cyan-200"
                        >
                          {p}: <span className="ml-1 font-semibold">{n}</span>
                        </Badge>
                      ))
                    ) : (
                      <span className="text-cyan-700/70">—</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Separator className="my-6" />

            {/* Sort Tabs */}
            <Tabs
              value={sort}
              onValueChange={(v) => setSort(v as any)}
              className="w-full"
            >
              <TabsList className="grid grid-cols-3 w-full rounded-xl">
                <TabsTrigger value="dueAsc">Due Date ↑</TabsTrigger>
                <TabsTrigger value="dueDesc">Due Date ↓</TabsTrigger>
                <TabsTrigger value="createdDesc">Newest First</TabsTrigger>
              </TabsList>

              <TabsContent value={sort} className="mt-6">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent" />
                    <span className="ml-4 text-lg text-slate-600">
                      Loading tasks…
                    </span>
                  </div>
                ) : sortedTasks.length === 0 ? (
                  <div className="text-center py-16">
                    <LayoutList className="h-16 w-16 mx-auto mb-6 text-slate-400" />
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">
                      No tasks found
                    </h3>
                    <p className="text-slate-600">
                      Try adjusting your filters or search.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Quick cycle nav */}
                    <div
                      ref={cyclesNavRef}
                      className="flex flex-wrap gap-2 mb-6"
                    >
                      {cycles.map((group, idx) => {
                        const { key, label } = group;
                        const active = expandedCycles[key];
                        return (
                          <Button
                            key={key}
                            variant={active ? "default" : "outline"}
                            onClick={() => {
                              toggleCycle(key);
                              const el = document.getElementById(
                                `cycle-${key}`
                              );
                              if (el)
                                el.scrollIntoView({
                                  behavior: "smooth",
                                  block: "start",
                                });
                            }}
                            className={cn(
                              "h-9 rounded-full",
                              active
                                ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white"
                                : ""
                            )}
                          >
                            <Hash className="h-4 w-4 mr-1" />
                            {label}
                          </Button>
                        );
                      })}
                    </div>

                    {/* Cycle sections */}
                    <div className="space-y-10">
                      {cycles.map(({ key, items, label }, idx) => {
                        const open = !!expandedCycles[key];
                        const headerLabel = label;

                        // mini-stats for the cycle header
                        const byStatus = items.reduce<Record<string, number>>(
                          (acc, t) => {
                            acc[t.status] = (acc[t.status] ?? 0) + 1;
                            return acc;
                          },
                          {}
                        );
                        const dueDateLabel = headerLabel;

                        return (
                          <section
                            key={key}
                            id={`cycle-${key}`}
                            className="rounded-2xl overflow-hidden border border-slate-200 shadow-xl"
                          >
                            {/* Lighter Section Header */}
                            <div
                              className={cn(
                                "px-6 py-5 text-slate-800 bg-gradient-to-r",
                                cycleGrad(Math.max(1, idx + 1))
                              )}
                            >
                              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-white/70 border border-slate-200 flex items-center justify-center">
                                    <Bookmark className="h-5 w-5 text-slate-700" />
                                  </div>
                                  <div>
                                    <div className="text-xl font-bold leading-5">
                                      {headerLabel}
                                    </div>
                                    <div className="text-slate-600 text-sm">
                                      {items.length} task
                                      {items.length !== 1 ? "s" : ""} • Due
                                      date: {dueDateLabel}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  {Object.entries(byStatus).map(([s, n]) => (
                                    <Badge
                                      key={s}
                                      variant="outline"
                                      className="border border-slate-300 bg-white/70 text-slate-700 capitalize"
                                    >
                                      {s.replaceAll("_", " ")}:{" "}
                                      <span className="ml-1 font-semibold">
                                        {n}
                                      </span>
                                    </Badge>
                                  ))}
                                  <Button
                                    variant="outline"
                                    className="bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                                    onClick={() => toggleCycle(key)}
                                  >
                                    {open ? "Collapse" : "Expand"}
                                    <ChevronRight
                                      className={cn(
                                        "h-4 w-4 ml-1 transition-transform",
                                        open && "rotate-90"
                                      )}
                                    />
                                  </Button>
                                </div>
                              </div>
                            </div>

                            {/* Section Body */}
                            {open && (
                              <div className="p-6 bg-white">
                                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                  {items.map((task) => {
                                    const assignee = task.assignedTo;
                                    const showPwd = !!showPasswordIds[task.id];

                                    return (
                                      <Card
                                        key={task.id}
                                        className="group border-2 hover:border-indigo-300 rounded-2xl transition-all bg-white/90"
                                      >
                                        <CardContent className="p-5">
                                          {/* Title & Badges */}
                                          <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <Badge
                                                  variant="outline"
                                                  className={cn(
                                                    "border",
                                                    categoryColor(
                                                      task.category?.name
                                                    )
                                                  )}
                                                >
                                                  <Bookmark className="h-3 w-3 mr-1" />
                                                  {task.category?.name ??
                                                    "Uncategorized"}
                                                </Badge>
                                                <Badge
                                                  variant="outline"
                                                  className={cn(
                                                    "border capitalize",
                                                    statusColor(task.status)
                                                  )}
                                                >
                                                  {task.status.replaceAll(
                                                    "_",
                                                    " "
                                                  )}
                                                </Badge>
                                                <Badge
                                                  variant="outline"
                                                  className={cn(
                                                    "border",
                                                    priorityColor(task.priority)
                                                  )}
                                                >
                                                  {task.priority}
                                                </Badge>
                                              </div>
                                              <div
                                                className="font-semibold text-slate-900 text-base truncate"
                                                title={task.name}
                                              >
                                                {task.name}
                                              </div>
                                            </div>
                                          </div>

                                          {/* Meta */}
                                          <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
                                            <div className="flex items-center gap-2">
                                              <CalendarDays className="h-4 w-4" />
                                              <span title={task.dueDate ?? ""}>
                                                Due: {formatDate(task.dueDate)}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <Clock className="h-4 w-4" />
                                              <span>
                                                Created:{" "}
                                                {formatDate(task.createdAt)}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <Timer className="h-4 w-4" />
                                              <span>
                                                Duration:{" "}
                                                {task.idealDurationMinutes ??
                                                  "—"}{" "}
                                                min
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <User className="h-4 w-4" />
                                              {assignee ? (
                                                <span
                                                  className="truncate"
                                                  title={assignee.email ?? ""}
                                                >
                                                  {assignee.name ??
                                                    assignee.email ??
                                                    "—"}
                                                </span>
                                              ) : (
                                                <span>Unassigned</span>
                                              )}
                                            </div>
                                          </div>

                                          {/* Credentials (URL / Username / Email / Password) */}
                                          <div className="mt-4 space-y-2 text-sm">
                                            <div className="flex items-center justify-between gap-2">
                                              <span className="text-slate-500">
                                                URL
                                              </span>
                                              <div className="flex items-center gap-2">
                                                {task.completionLink ? (
                                                  <>
                                                    <a
                                                      href={task.completionLink}
                                                      target="_blank"
                                                      rel="noreferrer"
                                                      className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium"
                                                    >
                                                      <Link2 className="h-4 w-4 mr-1" />
                                                      Open
                                                    </a>
                                                    <Button
                                                      variant="ghost"
                                                      size="icon"
                                                      className="h-8 w-8"
                                                      onClick={() =>
                                                        copyToClipboard(
                                                          task.completionLink,
                                                          "URL copied"
                                                        )
                                                      }
                                                      title="Copy URL"
                                                    >
                                                      <ClipboardCopy className="h-4 w-4" />
                                                    </Button>
                                                  </>
                                                ) : (
                                                  <span className="text-slate-400">
                                                    —
                                                  </span>
                                                )}
                                              </div>
                                            </div>

                                            <div className="flex items-center justify-between gap-2">
                                              <span className="text-slate-500">
                                                Username
                                              </span>
                                              <div className="flex items-center gap-2">
                                                <span
                                                  className="truncate max-w-[170px]"
                                                  title={task.username ?? ""}
                                                >
                                                  {task.username ?? "—"}
                                                </span>
                                                {task.username && (
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() =>
                                                      copyToClipboard(
                                                        task.username!,
                                                        "Username copied"
                                                      )
                                                    }
                                                    title="Copy username"
                                                  >
                                                    <ClipboardCopy className="h-4 w-4" />
                                                  </Button>
                                                )}
                                              </div>
                                            </div>

                                            <div className="flex items-center justify-between gap-2">
                                              <span className="text-slate-500">
                                                Email
                                              </span>
                                              <div className="flex items-center gap-2">
                                                <span
                                                  className="truncate max-w-[170px]"
                                                  title={task.email ?? ""}
                                                >
                                                  {task.email ?? "—"}
                                                </span>
                                                {task.email && (
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() =>
                                                      copyToClipboard(
                                                        task.email!,
                                                        "Email copied"
                                                      )
                                                    }
                                                    title="Copy email"
                                                  >
                                                    <ClipboardCopy className="h-4 w-4" />
                                                  </Button>
                                                )}
                                              </div>
                                            </div>

                                            <div className="flex items-center justify-between gap-2">
                                              <span className="text-slate-500">
                                                Password
                                              </span>
                                              <div className="flex items-center gap-2">
                                                {task.password ? (
                                                  <>
                                                    <span className="font-mono">
                                                      {showPwd
                                                        ? task.password
                                                        : "•".repeat(
                                                            Math.min(
                                                              12,
                                                              Math.max(
                                                                6,
                                                                task.password
                                                                  .length
                                                              )
                                                            )
                                                          )}
                                                    </span>
                                                    <Button
                                                      variant="ghost"
                                                      size="icon"
                                                      className="h-8 w-8"
                                                      onClick={() =>
                                                        setShowPasswordIds(
                                                          (s) => ({
                                                            ...s,
                                                            [task.id]:
                                                              !s[task.id],
                                                          })
                                                        )
                                                      }
                                                      title={
                                                        showPwd
                                                          ? "Hide password"
                                                          : "Reveal password"
                                                      }
                                                    >
                                                      {showPwd ? (
                                                        <EyeOff className="h-4 w-4" />
                                                      ) : (
                                                        <Eye className="h-4 w-4" />
                                                      )}
                                                    </Button>
                                                    <Button
                                                      variant="ghost"
                                                      size="icon"
                                                      className="h-8 w-8"
                                                      onClick={() =>
                                                        copyToClipboard(
                                                          task.password!,
                                                          "Password copied"
                                                        )
                                                      }
                                                      title="Copy password"
                                                    >
                                                      <ClipboardCopy className="h-4 w-4" />
                                                    </Button>
                                                  </>
                                                ) : (
                                                  <span className="text-slate-400">
                                                    —
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          </div>

                                          {/* Notes */}
                                          {task.notes ? (
                                            <div className="mt-4 text-sm text-slate-700">
                                              <div className="text-slate-500 mb-1">
                                                Notes
                                              </div>
                                              <div className="line-clamp-3">
                                                {task.notes}
                                              </div>
                                            </div>
                                          ) : null}
                                        </CardContent>
                                      </Card>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </section>
                        );
                      })}
                    </div>
                  </>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Modal for creating manual tasks */}
      {clientId && (
        <CreateNewTaskModal
          isOpen={isCreateTaskModalOpen}
          onClose={() => setIsCreateTaskModalOpen(false)}
          onSuccess={() => {
            mutate(); // Refresh the tasks list
          }}
          clientId={clientId}
        />
      )}
    </div>
  );
}
