// components/clients/clientsID/client-dashboard.tsx
"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MapPin, Building, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserSession } from "@/lib/hooks/use-user-session";
import ClientEditModal from "../client-edit-modal";
import { Profile } from "./profile";
import { Bio } from "./bio";
import { DriveImage } from "./drive-image";
import { SocialProfile } from "./social-profile";
import { Tasks } from "./task";
import { Client } from "@/types/client";
import { OtherInformation } from "./otherInformation";
import { ArticleTopics } from "./articleTopics";
import ExportClientTxtButton from "@/components/ExportClientTxtButton";
import { TemplateManagement } from "./template-management";
import { RenewPostingTasksButton } from "./renewbutton";

interface ClientDashboardProps {
  clientData: Client;
}

export function ClientDashboard({ clientData }: ClientDashboardProps) {
  const [activeTab, setActiveTab] = useState("profile");
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(
    () => new Set(["profile"])
  );
  const [editOpen, setEditOpen] = useState(false);
  const { user } = useUserSession();
  const roleName = (user as any)?.role?.name ?? (user as any)?.role ?? "";
  const isClient = String(roleName).toLowerCase() === "client";
  const isAgent = String(roleName).toLowerCase() === "agent";
  const isAdmin = String(roleName).toLowerCase().includes("admin");

  // Basic derived fields (lightweight)
  const packageMonths =
    Number((clientData as any)?.package?.totalMonths) &&
    Number((clientData as any)?.package?.totalMonths) > 0
      ? Math.floor(Number((clientData as any)?.package?.totalMonths))
      : 1;

  const isDueOver = (() => {
    const due = clientData.dueDate ? new Date(clientData.dueDate) : null;
    if (!due || isNaN(due.getTime())) return false;
    const now = new Date();
    return due.getTime() < now.getTime();
  })();

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const getDaysRemaining = () => {
    if (!clientData.dueDate) return 0;
    const dueDate = new Date(clientData.dueDate);
    const today = new Date();
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const getTotalDays = () => {
    if (!clientData.startDate || !clientData.dueDate) return 0;
    const startDate = new Date(clientData.startDate);
    const dueDate = new Date(clientData.dueDate);
    const diffTime = dueDate.getTime() - startDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // === FIXED: timezone-safe date formatter (uses DB string directly if YYYY-MM-DD) ===
  const formatDateStrict = (v?: string | Date | null) => {
    if (!v) return "-";
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    // If DB stores date-only string like "2025-11-09" (no time), use it as-is (no TZ shift)
    if (typeof v === "string") {
      const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) {
        const y = Number(m[1]);
        const mm = Number(m[2]);
        const dd = Number(m[3]);
        if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
          return `${monthNames[mm - 1]} ${dd}, ${y}`;
        }
      }
    }

    // Fallback: parse and format using UTC components to avoid local offset issues
    const d = new Date(v as any);
    if (isNaN(d.getTime())) return "-";
    const y = d.getUTCFullYear();
    const mIdx = d.getUTCMonth();
    const day = d.getUTCDate();
    return `${monthNames[mIdx]} ${day}, ${y}`;
  };

  // Explicit mapping: start = DB startDate, end = dueDate
  const startDisplay = formatDateStrict(clientData.startDate);
  const dueDisplay = formatDateStrict(clientData.dueDate);

  // Derived progress from tasks with normalized statuses (overall)
  const normalizeStatus = (raw?: string | null) => {
    const s = (raw ?? "")
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[\-\s]+/g, "_");
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

  const totalTasks = clientData.tasks?.length || 0;
  const completedTasks =
    clientData.tasks?.filter(
      (t: any) => normalizeStatus(t?.status) === "completed"
    ).length || 0;

  const derivedProgress = totalTasks
    ? Math.round((completedTasks / totalTasks) * 100)
    : 0;

  // ---------------------------
  // This Month stats
  // ---------------------------
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1); // exclusive

  const parseDate = (v?: string | Date | null) => {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  };

  // Prefer createdAt; fallback to startDate; then dueDate
  const getBestDate = (task: any): Date | null => {
    return (
      parseDate(task?.createdAt) ||
      parseDate(task?.startDate) ||
      parseDate(task?.dueDate)
    );
  };

  const inThisMonth = (task: any) => {
    const d = getBestDate(task);
    if (!d) return false;
    return d >= monthStart && d < monthEnd;
  };

  // Monthly filtered tasks
  const tasksThisMonth = (clientData.tasks ?? []).filter(inThisMonth);
  const totalThisMonth = tasksThisMonth.length;

  // helper to keep raw (non-normalized) for approved detection
  const rawStatus = (raw?: string | null) =>
    (raw ?? "")
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[\-\s]+/g, "_");

  // Monthly tallies
  let completedThisMonth = 0;
  let approvedThisMonth = 0;
  let pendingThisMonth = 0;

  for (const t of tasksThisMonth) {
    const sRaw = rawStatus(t?.status);
    const sNorm = normalizeStatus(t?.status);
    const completedAt = parseDate(t?.completedAt);
    const dueDate = parseDate(t?.dueDate);

    // Completed if completedAt is in this month OR status says completed
    const isCompleted =
      (completedAt
        ? completedAt >= monthStart && completedAt < monthEnd
        : false) || sNorm === "completed";

    // Approved if status explicitly qc_approved/approved
    const isApproved = sRaw === "qc_approved" || sRaw === "approved";

    // Pending if explicitly pending OR not completed/approved but tied to this month (due this month or no explicit dates)
    const isPending =
      sNorm === "pending" ||
      (!isCompleted &&
        !isApproved &&
        (!!dueDate ? dueDate >= monthStart && dueDate < monthEnd : true));

    if (isCompleted) completedThisMonth++;
    if (isApproved) approvedThisMonth++;
    if (isPending) pendingThisMonth++;
  }

  // This month progress = (completed + approved) / totalThisMonth
  const derivedProgressThisMonth = totalThisMonth
    ? Math.round(
        ((completedThisMonth + approvedThisMonth) / totalThisMonth) * 100
      )
    : 0;

  // Clamp values for display
  const displayOverall = Math.min(100, Math.max(0, derivedProgress));
  const displayThisMonth = Math.min(100, Math.max(0, derivedProgressThisMonth));

  const totalAssets = totalTasks;

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    setMountedTabs((prev) => {
      if (prev.has(val)) return prev;
      const next = new Set(prev);
      next.add(val);
      return next;
    });
  };

  return (
    <div>
      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16 ring-4 ring-blue-100 dark:ring-blue-900">
                <AvatarImage
                  src={clientData.avatar || undefined}
                  alt={clientData.name}
                />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-lg font-bold">
                  {getInitials(clientData.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {clientData.name}
                </h1>

                {/* Company / Location / Status */}
                <div className="flex items-center space-x-4 mt-1">
                  <div className="flex items-center text-slate-600 dark:text-slate-400">
                    <Building className="h-4 w-4 mr-1" />
                    <span className="text-sm">{clientData.company ?? ""}</span>
                  </div>
                  <div className="flex items-center text-slate-600 dark:text-slate-400">
                    <MapPin className="h-4 w-4 mr-1" />
                    <span className="text-sm">{clientData.location ?? ""}</span>
                  </div>
                  <Badge
                    variant={
                      clientData.status === "active" ? "default" : "secondary"
                    }
                  >
                    {clientData.status ?? "inactive"}
                  </Badge>
                </div>

                {/* === Added: Package Timeline (start = startDate, end = dueDate) === */}
                <div className="mt-2">
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                    Package Timeline
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-blue-50 text-blue-700 border border-blue-200">
                      Start: {startDisplay}
                    </Badge>
                    <Badge className="bg-purple-50 text-purple-700 border border-purple-200">
                      End: {dueDisplay}
                    </Badge>
                  </div>
                </div>
                {/* === End Added === */}
              </div>
            </div>

            {/* Statistics (Overall) */}
            <div className="flex space-x-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {displayOverall}%
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Overall Progress
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {displayThisMonth}%
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  This Month Progress
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {totalAssets}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Tasks
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {getDaysRemaining()}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Days Left
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {getTotalDays()}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Total Days
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 py-8">
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-8 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700">
            <TabsTrigger
              value="profile"
              className="data-[state=active]:bg-blue-500 data-[state=active]:text-white"
            >
              Profile
            </TabsTrigger>
            <TabsTrigger
              value="other-information"
              className="data-[state=active]:bg-blue-500 data-[state=active]:text-white"
            >
              Other Information
            </TabsTrigger>
            <TabsTrigger
              value="bio"
              className="data-[state=active]:bg-blue-500 data-[state=active]:text-white"
            >
              Bio
            </TabsTrigger>
            <TabsTrigger
              value="drive-image"
              className="data-[state=active]:bg-blue-500 data-[state=active]:text-white"
            >
              Drive Image
            </TabsTrigger>
            <TabsTrigger
              value="article-topics"
              className="data-[state=active]:bg-blue-500 data-[state=active]:text-white"
            >
              Article Topics
            </TabsTrigger>
            <TabsTrigger
              value="social-profile"
              className="data-[state=active]:bg-blue-500 data-[state=active]:text-white"
            >
              Social Profile
            </TabsTrigger>
            <TabsTrigger
              value="template"
              className="data-[state=active]:bg-blue-500 data-[state=active]:text-white"
            >
              Template
            </TabsTrigger>
            <TabsTrigger
              value="tasks"
              className="data-[state=active]:bg-blue-500 data-[state=active]:text-white"
            >
              Tasks
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-4 items-center justify-end">
            {!isClient && (
              <div>
                <Button
                  variant="outline"
                  onClick={() => setEditOpen(true)}
                  title={
                    isClient
                      ? "Clients cannot edit the profile"
                      : "Edit client profile"
                  }
                  className="gap-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 dark:from-blue-500 dark:to-purple-500 dark:hover:from-blue-600 dark:hover:to-purple-600 text-white hover:text-white disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <PencilLine className="h-4 w-4" />
                  Edit Profile
                </Button>
              </div>
            )}
            {isAgent && (
              <div>
                <ExportClientTxtButton clientData={clientData} />
              </div>
            )}
            {isAdmin && isDueOver && (
              <div>
                <RenewPostingTasksButton
                  clientId={clientData.id}
                  templateId={undefined}
                  packageMonths={packageMonths}
                />
              </div>
            )}
          </div>

          {mountedTabs.has("profile") && (
            <TabsContent value="profile">
              <Profile clientData={clientData} />
            </TabsContent>
          )}

          {mountedTabs.has("other-information") && (
            <TabsContent value="other-information">
              <OtherInformation clientData={clientData} />
            </TabsContent>
          )}

          {mountedTabs.has("bio") && (
            <TabsContent value="bio">
              <Bio clientData={clientData} />
            </TabsContent>
          )}

          {mountedTabs.has("drive-image") && (
            <TabsContent value="drive-image">
              <DriveImage clientData={clientData} />
            </TabsContent>
          )}

          {mountedTabs.has("article-topics") && (
            <TabsContent value="article-topics">
              <ArticleTopics clientData={clientData} />
            </TabsContent>
          )}

          {mountedTabs.has("social-profile") && (
            <TabsContent value="social-profile">
              <SocialProfile clientData={clientData} />
            </TabsContent>
          )}

          {mountedTabs.has("template") && (
            <TabsContent value="template">
              <TemplateManagement clientData={clientData} />
            </TabsContent>
          )}

          {mountedTabs.has("tasks") && (
            <TabsContent value="tasks">
              <Tasks clientData={clientData} />
            </TabsContent>
          )}
        </Tabs>
        <ClientEditModal
          open={editOpen}
          onOpenChange={setEditOpen}
          clientData={clientData as any}
        />
      </div>
    </div>
  );
}
