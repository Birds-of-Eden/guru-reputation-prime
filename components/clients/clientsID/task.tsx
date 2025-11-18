//components/clients/[clientsID]/task.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  TrendingUp,
  Target,
  Calendar,
  BarChart3,
  Activity,
  CheckCircle,
  AlertCircle,
  Loader,
  Link as LinkIcon,
  FileText,
  FileDown,
  ClipboardList,
  ListChecks,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Client } from "@/types/client";
import { PostingTaskStatus } from "./posting-task-status";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ---------- Small UI Helpers ----------
const Pill = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-100">
    {children}
  </span>
);

const LinkPill = ({ href, label }: { href: string; label?: string }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-blue-700 hover:underline dark:border-slate-700 dark:bg-slate-800"
  >
    <LinkIcon className="h-3.5 w-3.5" />
    {label ?? href}
  </a>
);

const KeyStat = ({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) => (
  <div className="flex items-center gap-2">
    <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
    <Pill>{value}</Pill>
  </div>
);

interface TasksProps {
  clientData: Client;
}

export function Tasks({ clientData }: TasksProps) {
  type TaskItem = NonNullable<Client["tasks"]>[number];

  const [pdfPreview, setPdfPreview] = useState<{
    open: boolean;
    title?: string;
    url?: string;
  }>({ open: false });

  // ---------- Aggregates ----------
  const normalizeStatus = (raw?: string | null) => {
    const s = (raw ?? "")
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[-\s]+/g, "_");
    if (
      [
        "done",
        "complete",
        "completed",
        "finished",
        "qc_approved",
        "approved",
      ].includes(s)
    )
      return "completed";
    if (
      ["in_progress", "in-progress", "progress", "doing", "working"].includes(s)
    )
      return "in_progress";
    if (["overdue", "late"].includes(s)) return "overdue";
    if (
      [
        "pending",
        "todo",
        "not_started",
        "on_hold",
        "paused",
        "backlog",
      ].includes(s)
    )
      return "pending";
    return s || "pending";
  };

  const RenderMonitoring = (task: TaskItem) => {
    const status = normalizeStatus((task as any).status);
    const data = (task as any)?.taskCompletionJson || {};
    const sheets = Array.isArray(data?.monitoringSheets)
      ? ((data as any).monitoringSheets as {
          id?: string;
          name?: string;
          columns?: string[];
          rows?: Record<string, string>[];
        }[])
      : [];

    if (status !== "completed") return <PendingBox />;
    if (!sheets.length)
      return <PendingBox note="Completed, but no monitoring data attached." />;

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3">
          <KeyStat
            label="Completion Date"
            value={formatDate(data?.completionDate)}
          />
          <KeyStat label="Sheets" value={sheets.length} />
        </div>
        <div className="space-y-4">
          {sheets.map((s, idx) => (
            <div
              key={s?.id || idx}
              className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800"
            >
              <SectionTitle
                icon={<BarChart3 className="h-4 w-4" />}
                title={s?.name || `Sheet ${idx + 1}`}
              />
              <div className="overflow-x-auto">
                <table className="min-w-[400px] text-sm">
                  <thead>
                    <tr>
                      {(s?.columns || []).map((c, i) => (
                        <th
                          key={i}
                          className="px-2 py-1 text-left font-semibold border-b"
                        >
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(s?.rows || []).map((r, ri) => (
                      <tr key={ri}>
                        {(s?.columns || []).map((c, ci) => (
                          <td key={ci} className="px-2 py-1 border-b">
                            {(r || {})[c] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const totalTasks = clientData.tasks?.length || 0;
  const completedTasks =
    clientData.tasks?.filter(
      (t) => normalizeStatus((t as any).status) === "completed"
    ).length || 0;
  const inProgressTasks =
    clientData.tasks?.filter(
      (t) => normalizeStatus((t as any).status) === "in_progress"
    ).length || 0;
  const pendingTasks =
    clientData.tasks?.filter(
      (t) => normalizeStatus((t as any).status) === "pending"
    ).length || 0;
  const overdueTasks =
    clientData.tasks?.filter(
      (t) => normalizeStatus((t as any).status) === "overdue"
    ).length || 0;

  // QC helpers
  type TaskWithQC = TaskItem & {
    reviewStatus?: string | null;
    qcApproved?: boolean | string | null;
    review?: { status?: string | null };
  };
  const isQcApproved = (t: TaskWithQC) => {
    const norm = (s?: string | null) =>
      (s ?? "")
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");
    const statusFromTask = norm((t as any).status);
    const status =
      norm(t.reviewStatus) || norm(t.review?.status) || statusFromTask;
    const approvedVariants = new Set([
      "qc_approved",
      "approved_by_qc",
      "approved",
      "qa_approved",
    ]);
    const flag = t.qcApproved === true || t.qcApproved === "true";
    return flag || approvedVariants.has(status);
  };
  const qcApprovedTasks =
    clientData.tasks?.filter((t) => isQcApproved(t as TaskWithQC)).length ?? 0;
  const derivedProgress = totalTasks
    ? Math.round((completedTasks / totalTasks) * 100)
    : 0;

  // ---------- Dates ----------
  const getDaysElapsed = () => {
    if (!clientData.startDate) return 0;
    const start = new Date(clientData.startDate).getTime();
    const today = Date.now();
    return Math.max(0, Math.ceil((today - start) / (1000 * 60 * 60 * 24)));
  };
  const getDaysRemaining = () => {
    if (!clientData.dueDate) return 0;
    const due = new Date(clientData.dueDate).getTime();
    const today = Date.now();
    return Math.max(0, Math.ceil((due - today) / (1000 * 60 * 60 * 24)));
  };
  const getTotalDays = () => {
    if (!clientData.startDate || !clientData.dueDate) return 0;
    const start = new Date(clientData.startDate).getTime();
    const due = new Date(clientData.dueDate).getTime();
    return Math.max(0, Math.ceil((due - start) / (1000 * 60 * 60 * 24)));
  };

  // ---------- UI helpers ----------
  const getProgressColor = (progress: number) => {
    if (progress >= 80) return "text-green-600 dark:text-green-400";
    if (progress >= 50) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getStatusIcon = (status: string) => {
    const s = normalizeStatus(status);
    switch (s) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "in_progress":
        return <Loader className="h-4 w-4 text-blue-500 animate-spin" />;
      case "pending":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "overdue":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    const s = normalizeStatus(status);
    switch (s) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "in_progress":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "overdue":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "medium":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "low":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const ColoredProgress = ({
    value,
    gradient,
  }: {
    value: number;
    gradient: string;
  }) => (
    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
      <div
        className={`h-2 rounded-full bg-gradient-to-r ${gradient} transition-all`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );

  // ---------- Category plumbing ----------
  // Normalize category names to canonical labels matching the desired order
  const canonicalCategory = (raw?: string | null) => {
    const name = (raw ?? "").trim();
    if (!name || /^uncategorized$/i.test(name))
      return "Additional Asset Creation";

    const lower = name.toLowerCase();
    if (
      /^web\s*2(\.0)?/.test(lower) ||
      /web2/.test(lower) ||
      /web\s*2\.0\s*platform/.test(lower) ||
      /web 2\.?0 asset/.test(lower)
    ) {
      return "Web 2.0 Creation";
    }
    if (/additional\s*asset/.test(lower)) return "Additional Asset Creation";
    if (/graphics?\s*design/.test(lower)) return "Graphics Design";
    if (/social\s*asset\s*creation/.test(lower)) return "Social Asset Creation";
    if (/social\s*activity/.test(lower)) return "Social Activity";
    if (/content\s*studio/.test(lower)) return "Content Studio";
    if (/youtube.*(optimization|optimi[sz]ation|seo)/.test(lower))
      return "YouTube Video Optimization";
    if (/backlinks?/.test(lower)) return "Backlinks";
    if (/blog\s*posting/.test(lower)) return "Blog Posting";
    if (/content\s*writing/.test(lower)) return "Content Writing";
    if (/guest\s*posting/.test(lower)) return "Guest Posting";
    if (/review\s*removal/.test(lower)) return "Review Removal";
    if (/summary\s*report/.test(lower)) return "Summary Report";
    return name;
  };

  // Detect a functional type for R&D renderers (from asset.type or canonical category)
  const getFunctionalType = (task: TaskItem) => {
    const t =
      (task as any)?.templateSiteAsset?.type?.toString()?.toLowerCase() || "";
    if (t) return t;
    const cat = canonicalCategory(task?.category?.name)
      .toLowerCase()
      .replace(/\s+/g, "_");
    return cat; // e.g., "content_writing", "guest_posting", "backlinks", "review_removal", "summary_report"
  };

  // Build groups
  const grouped: Record<string, TaskItem[]> =
    clientData.tasks?.reduce((acc, task) => {
      const key = canonicalCategory(task?.category?.name);
      if (!acc[key]) acc[key] = [];
      acc[key].push(task as TaskItem);
      return acc;
    }, {} as Record<string, TaskItem[]>) || {};

  // Sort tasks: Completed → In Progress → Pending → Overdue, then priority, then due date
  const STATUS_ORDER = ["completed", "in_progress", "pending", "overdue"];
  const PRIORITY_ORDER = ["high", "medium", "low"];
  const sortTasks = (tasks: TaskItem[]) =>
    [...tasks].sort((a, b) => {
      const sA = STATUS_ORDER.indexOf(normalizeStatus((a as any).status));
      const sB = STATUS_ORDER.indexOf(normalizeStatus((b as any).status));
      if (sA !== sB) return sA - sB;
      const pA = PRIORITY_ORDER.indexOf((a.priority || "low") as any);
      const pB = PRIORITY_ORDER.indexOf((b.priority || "low") as any);
      if (pA !== pB) return pA - pB;
      const dA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const dB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return dA - dB;
    });

  // Category flow (yours) + others alphabetical
  const CATEGORY_FLOW = [
    "Graphics Design",
    "Social Asset Creation",
    "Web 2.0 Creation",
    "Additional Asset Creation",
    "Blog Posting",
    "Social Activity",
    "Backlinks",
    "Content Studio",
    "YouTube Video Optimization",
    "Content Writing",
    "Guest Posting",
    "Review Removal",
    "Summary Report",
  ];

  const orderedCategories = Object.entries(grouped).sort(([a], [b]) => {
    const ia = CATEGORY_FLOW.indexOf(a);
    const ib = CATEGORY_FLOW.indexOf(b);
    const aIn = ia !== -1;
    const bIn = ib !== -1;
    if (aIn && bIn) return ia - ib;
    if (aIn) return -1;
    if (bIn) return 1;
    return a.localeCompare(b);
  });

  // ---------- R&D: data helpers ----------
  const cleanUrl = (raw?: string | null) => {
    const s = (raw ?? "")
      .trim()
      .replace(/^"+|"+$/g, "")
      .replace(/^'+|'+$/g, "");
    // If someone double-pasted "https://\"https://..." keep last https
    const m = s.match(/https?:\/\/[^\s"]+/g);
    return m?.[m.length - 1] || s;
  };
  const formatDate = (d?: string | null) => {
    if (!d) return "—";
    const dt = new Date(d);
    return isNaN(+dt) ? "—" : dt.toLocaleDateString();
  };

  // ---------- R&D: per-category renderers ----------
  const PendingBox = ({ note }: { note?: string }) => (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-200">
      <ClipboardList className="mr-1 inline h-4 w-4" />
      {note || "Pending — awaiting completion data."}
    </div>
  );

  const SectionTitle = ({
    icon,
    title,
  }: {
    icon: React.ReactNode;
    title: string;
  }) => (
    <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
      {icon}
      <span>{title}</span>
    </div>
  );

  const RenderContentWriting = (task: TaskItem) => {
    const status = normalizeStatus((task as any).status);
    const items = (task as any)?.taskCompletionJson?.contentWriting as
      | { title?: string; content?: string }[]
      | undefined;

    if (status !== "completed") return <PendingBox />;
    if (!items?.length)
      return <PendingBox note="Completed, but no content items attached." />;

    return (
      <div className="space-y-3">
        {items.map((it, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800"
          >
            <SectionTitle
              icon={<FileText className="h-4 w-4" />}
              title={it?.title || `Item ${idx + 1}`}
            />
            {it?.content ? (
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                // NOTE: ensure server-side sanitization; this trusts your API.
                dangerouslySetInnerHTML={{ __html: it.content }}
              />
            ) : (
              <p className="text-sm text-slate-500">No content provided.</p>
            )}
          </div>
        ))}
      </div>
    );
  };

  const RenderGuestPosting = (task: TaskItem) => {
    // same schema as content writing per your example
    return RenderContentWriting(task);
  };

  const RenderBacklinks = (task: TaskItem) => {
    const status = normalizeStatus((task as any).status);
    const data = (task as any)?.taskCompletionJson || {};
    const links: string[] = Array.isArray(data?.backlinkingLinks)
      ? data.backlinkingLinks
      : [];

    if (status !== "completed") return <PendingBox />;
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3">
          <KeyStat label="Month" value={data?.month ?? "—"} />
          <KeyStat label="Quantity" value={data?.quantity ?? "—"} />
          <KeyStat label="Drip Period" value={data?.dripPeriod ?? "—"} />
          <KeyStat label="Order Date" value={formatDate(data?.orderDate)} />
          {data?.doneByAgentId && (
            <KeyStat label="Done By" value={data.doneByAgentId} />
          )}
        </div>
        <div>
          <SectionTitle
            icon={<ListChecks className="h-4 w-4" />}
            title="Backlink URLs"
          />
          <div className="flex flex-wrap gap-2">
            {links.length ? (
              links.map((raw, i) => {
                const href = cleanUrl(raw);
                const label = `Link ${i + 1}`;
                return <LinkPill key={i} href={href} label={label} />;
              })
            ) : (
              <p className="text-sm text-slate-500">No links attached.</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const RenderReviewRemoval = (task: TaskItem) => {
    const status = normalizeStatus((task as any).status);
    const links: string[] =
      (task as any)?.taskCompletionJson?.reviewRemoval || [];

    if (status !== "completed") return <PendingBox />;
    return (
      <div className="space-y-2">
        <SectionTitle
          icon={<ListChecks className="h-4 w-4" />}
          title="Review Links"
        />
        <div className="flex flex-wrap gap-2">
          {links.length ? (
            links.map((raw, i) => {
              const href = cleanUrl(raw);
              return (
                <LinkPill key={i} href={href} label={`ReviewLink${i + 1}`} />
              );
            })
          ) : (
            <p className="text-sm text-slate-500">No review links provided.</p>
          )}
        </div>
      </div>
    );
  };

  const RenderSummaryReport = (task: TaskItem) => {
    const status = normalizeStatus((task as any).status);
    const data = (task as any)?.taskCompletionJson || {};
    const title = data?.title;
    const text = data?.text;
    const pdf = data?.pdfFileName;
    const pdfData: string | undefined = data?.pdfData;
    const pdfType: string | undefined = data?.pdfType;

    if (status !== "completed") return <PendingBox />;
    return (
      <div className="space-y-3">
        <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
          <SectionTitle
            icon={<FileText className="h-4 w-4" />}
            title={title || "Summary Report"}
          />
          {text ? (
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: text }}
            />
          ) : (
            <p className="text-sm text-slate-500">No report text provided.</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <KeyStat label="PDF" value={pdf || (pdfData ? "Attached" : "—")} />
          {pdfData ? (
            <>
              <button
                type="button"
                onClick={() =>
                  setPdfPreview({
                    open: true,
                    title: title || pdf || "Summary Report",
                    url: pdfData,
                  })
                }
                className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline"
              >
                <FileText className="h-3.5 w-3.5" /> View
              </button>
              <a
                href={pdfData}
                download={pdf || "summary-report.pdf"}
                className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline"
              >
                <FileDown className="h-3.5 w-3.5" /> Download
              </a>
            </>
          ) : (
            pdf && (
              <span className="ml-1 inline-flex items-center gap-1 text-xs text-blue-700">
                <FileDown className="h-3.5 w-3.5" />
                {pdf}
              </span>
            )
          )}
        </div>
      </div>
    );
  };

  // Map functional type to renderer
  const renderSpecialByType = (task: TaskItem) => {
    const t = getFunctionalType(task);
    if (t.includes("content_writing"))
      return <RenderContentWriting {...(task as any)} />;
    if (t.includes("guest_posting"))
      return <RenderGuestPosting {...(task as any)} />;
    if (t.includes("backlinks")) return <RenderBacklinks {...(task as any)} />;
    if (t.includes("review_removal"))
      return <RenderReviewRemoval {...(task as any)} />;
    if (t.includes("summary_report"))
      return <RenderSummaryReport {...(task as any)} />;
    if (t.includes("monitoring"))
      return <RenderMonitoring {...(task as any)} />;
    return null;
  };

  // Header color
  const headerGradient = (category: string) => {
    if (category === "Graphics Design")
      return "from-fuchsia-500/10 to-rose-500/10 dark:from-fuchsia-500/20 dark:to-rose-500/20";
    if (category === "Social Asset Creation")
      return "from-pink-500/10 to-rose-500/10 dark:from-pink-500/20 dark:to-rose-500/20";
    if (category === "Web 2.0 Creation")
      return "from-indigo-500/10 to-cyan-500/10 dark:from-indigo-500/20 dark:to-cyan-500/20";
    if (
      category === "Additional Asset" ||
      category === "Additional Asset Creation"
    )
      return "from-purple-500/10 to-pink-500/10 dark:from-purple-500/20 dark:to-pink-500/20";
    if (category === "Backlinks")
      return "from-amber-500/10 to-yellow-500/10 dark:from-amber-500/20 dark:to-yellow-500/20";
    if (category === "Blog Posting")
      return "from-emerald-500/10 to-green-500/10 dark:from-emerald-500/20 dark:to-green-500/20";
    if (category === "Social Activity")
      return "from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20";
    if (category === "Content Studio")
      return "from-sky-500/10 to-blue-500/10 dark:from-sky-500/20 dark:to-blue-500/20";
    if (category === "YouTube Video Optimization")
      return "from-red-500/10 to-orange-500/10 dark:from-red-500/20 dark:to-orange-500/20";
    if (category === "Content Writing")
      return "from-sky-500/10 to-blue-500/10 dark:from-sky-500/20 dark:to-blue-500/20";
    if (category === "Guest Posting")
      return "from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20";
    if (category === "Review Removal")
      return "from-rose-500/10 to-red-500/10 dark:from-rose-500/20 dark:to-red-500/20";
    if (category === "Summary Report")
      return "from-teal-500/10 to-emerald-500/10 dark:from-teal-500/20 dark:to-emerald-500/20";
    return "from-slate-500/10 to-slate-500/10 dark:from-slate-500/20 dark:to-slate-500/20";
  };

  return (
    <div className="space-y-6">
      {/* Overview Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="shadow-lg border-0 bg-white dark:bg-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Overall Progress
                </p>
                <p
                  className={`text-2xl font-bold ${getProgressColor(
                    derivedProgress
                  )}`}
                >
                  {derivedProgress}%
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {completedTasks} completed / {inProgressTasks} in progress /{" "}
                  {pendingTasks + overdueTasks} pending
                </p>
              </div>
              <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="mt-4">
              <ColoredProgress
                value={derivedProgress}
                gradient="from-blue-500 to-purple-600"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0 bg-white dark:bg-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Total Tasks
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {totalTasks}
                </p>
              </div>
              <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg">
                <Target className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="mt-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {completedTasks} completed, {pendingTasks + overdueTasks}{" "}
                pending
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0 bg-white dark:bg-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Days Elapsed
                </p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {getDaysElapsed()}
                </p>
              </div>
              <div className="p-3 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg">
                <Calendar className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="mt-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                out of {getTotalDays()} total days
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0 bg-white dark:bg-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Days Remaining
                </p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {getDaysRemaining()}
                </p>
              </div>
              <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg">
                <Clock className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="mt-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                until completion
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Task Breakdown */}
      <Card className="shadow-lg border-0 bg-white dark:bg-slate-800">
        <CardHeader className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="text-indigo-600" />
            <span>Task Breakdown- {clientData.name}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-slate-900 dark:text-slate-100">
                  QC Approved
                </h4>
                <Badge
                  variant="outline"
                  className="bg-green-50 text-green-700 border-green-200"
                >
                  {qcApprovedTasks}
                </Badge>
              </div>
              <ColoredProgress
                value={
                  completedTasks > 0
                    ? (qcApprovedTasks / completedTasks) * 100
                    : 0
                }
                gradient="from-green-500 to-emerald-600"
              />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {qcApprovedTasks} of {completedTasks} tasks QC approved
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-slate-900 dark:text-slate-100">
                  Completed
                </h4>
                <Badge
                  variant="outline"
                  className="bg-green-50 text-green-700 border-green-200"
                >
                  {completedTasks}
                </Badge>
              </div>
              <ColoredProgress
                value={totalTasks ? (completedTasks / totalTasks) * 100 : 0}
                gradient="from-green-500 to-emerald-600"
              />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {completedTasks} of {totalTasks} tasks completed
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-slate-900 dark:text-slate-100">
                  In Progress
                </h4>
                <Badge
                  variant="outline"
                  className="bg-blue-50 text-blue-700 border-blue-200"
                >
                  {inProgressTasks}
                </Badge>
              </div>
              <ColoredProgress
                value={totalTasks ? (inProgressTasks / totalTasks) * 100 : 0}
                gradient="from-blue-500 to-cyan-500"
              />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {inProgressTasks} of {totalTasks} tasks in progress
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-slate-900 dark:text-slate-100">
                  Pending
                </h4>
                <Badge
                  variant="outline"
                  className="bg-yellow-50 text-yellow-700 border-yellow-200"
                >
                  {pendingTasks + overdueTasks}
                </Badge>
              </div>
              <ColoredProgress
                value={
                  totalTasks
                    ? ((pendingTasks + overdueTasks) / totalTasks) * 100
                    : 0
                }
                gradient="from-amber-400 to-yellow-500"
              />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {pendingTasks + overdueTasks} of {totalTasks} tasks pending
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card className="shadow-lg border-0 bg-white dark:bg-slate-800">
        <CardHeader className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20">
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-emerald-600" />
            <span>Tasks by Category</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 md:p-4">
          <Accordion type="multiple" className="w-full">
            {orderedCategories.map(([categoryName, rawTasks]) => {
              const tasks = sortTasks(rawTasks);
              return (
                <AccordionItem
                  key={categoryName}
                  value={categoryName}
                  className="border-slate-200 dark:border-slate-700"
                >
                  <AccordionTrigger className="px-4 py-3 rounded-md hover:no-underline group">
                    <div
                      className={`w-full flex items-center justify-between rounded-md px-2 py-1.5 bg-gradient-to-r ${headerGradient(
                        categoryName
                      )}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{categoryName}</span>
                        <Badge variant="secondary">{tasks.length}</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          {
                            tasks.filter(
                              (t) =>
                                normalizeStatus((t as any).status) ===
                                "completed"
                            ).length
                          }{" "}
                          done
                        </Badge>
                        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {
                            tasks.filter(
                              (t) =>
                                normalizeStatus((t as any).status) ===
                                "in_progress"
                            ).length
                          }{" "}
                          doing
                        </Badge>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-1 md:px-2 pb-4">
                    <div className="space-y-4 pt-3">
                      {tasks.map((task) => {
                        const platform =
                          task.templateSiteAsset?.name || "Platform";
                        const duration = task.idealDurationMinutes ?? 0;
                        const link =
                          (task as any).completionLink?.trim?.() ||
                          task.templateSiteAsset?.url ||
                          "";
                        const status = normalizeStatus((task as any).status);
                        const functionalType = getFunctionalType(task);

                        return (
                          <div
                            key={task.id}
                            className="flex flex-col gap-3 p-4 bg-slate-50 dark:bg-slate-700 rounded-xl border border-slate-200/70 dark:border-slate-700/70"
                          >
                            {/* Top line */}
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5">
                                  {getStatusIcon(task.status)}
                                </div>
                                <div>
                                  <h4 className="font-medium text-slate-900 dark:text-slate-100">
                                    {task.name}
                                  </h4>
                                  <p className="text-sm text-slate-500 dark:text-slate-300">
                                    {platform} • {duration} min
                                  </p>
                                  {link && (
                                    <a
                                      href={link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1 break-all"
                                    >
                                      <LinkIcon className="h-3.5 w-3.5" />
                                      {link}
                                    </a>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 self-start md:self-center">
                                <Badge
                                  className={getPriorityColor(task.priority)}
                                >
                                  {task.priority}
                                </Badge>
                                <Badge
                                  className={getStatusColor(
                                    (task as any).status
                                  )}
                                >
                                  {status.replace(/_/g, " ")}
                                </Badge>
                              </div>
                            </div>

                            {/* NEW: Special per-category renderers */}
                            <div className="rounded-lg bg-white/60 p-3 dark:bg-slate-800/60">
                              {renderSpecialByType(task) ||
                                (() => {
                                  const notes =
                                    (task as any)?.taskCompletionJson?.notes ||
                                    (task as any)?.notes;
                                  if (notes) {
                                    return (
                                      <div className="space-y-1">
                                        <SectionTitle
                                          icon={
                                            <FileText className="h-4 w-4" />
                                          }
                                          title="Notes"
                                        />
                                        <div
                                          className="prose prose-sm max-w-none dark:prose-invert"
                                          // NOTE: ensure server-side sanitization; this trusts your API.
                                          dangerouslySetInnerHTML={{
                                            __html: notes,
                                          }}
                                        />
                                      </div>
                                    );
                                  }
                                  return (
                                    <p className="text-sm text-slate-500">
                                      {/* Default: compact note for categories without custom renderer */}
                                      No extra completion data for this
                                      category.
                                    </p>
                                  );
                                })()}
                            </div>

                            {/* NEW: Posting Task Status for tasks with assets */}
                            {(() => {
                              const categoryName =
                                task.category?.name?.toLowerCase() || "";
                              const shouldShowPosting =
                                categoryName.includes("qc") ||
                                categoryName.includes("quality") ||
                                categoryName.includes("asset creation") ||
                                categoryName.includes("social asset") ||
                                categoryName.includes("web2") ||
                                categoryName.includes("content writing") ||
                                categoryName.includes("graphics");

                              const isTaskCompleted =
                                status === "completed" ||
                                (task as any).status?.toLowerCase() ===
                                  "qc_approved" ||
                                (task as any).status
                                  ?.toLowerCase()
                                  .includes("approved");

                              return (
                                shouldShowPosting && (
                                  <PostingTaskStatus
                                    qcTaskId={task.id}
                                    qcTaskName={task.name || "Task"}
                                    assetName={
                                      task.templateSiteAsset?.name || platform
                                    }
                                    assignmentId={task.assignmentId || ""}
                                    clientName={clientData.name}
                                    templateSiteAssetId={
                                      task.templateSiteAssetId || undefined
                                    }
                                    isCompleted={isTaskCompleted}
                                  />
                                )
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      <Dialog
        open={pdfPreview.open}
        onOpenChange={(o) => setPdfPreview((p) => ({ ...p, open: o }))}
      >
        <DialogContent className="max-w-5xl h-[85vh]">
          {pdfPreview.url ? (
            <iframe
              src={pdfPreview.url}
              title={pdfPreview.title || "PDF"}
              className="w-full h-full rounded-md border"
            />
          ) : (
            <div className="text-sm text-slate-500">No PDF to preview.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
