"use client";

import React, { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { List, Grid3X3, Building2 as DefaultIcon } from "lucide-react";
import { Agent, Task, TaskAssignment } from "./distribution-types";
import { siteTypeIcons } from "./task-constants";
import { TaskCard } from "./TaskCard";
import { TaskListItem } from "./TaskListItem";

type AgentWithLoad = Agent & {
  displayLabel?: string;
  activeCount?: number;
  weightedScore?: number;
  byStatus?: Record<string, number>;
};

interface TabContentProps {
  siteType: string;
  tasks: Task[];

  // NEW: both pools available to each card
  teamAgents: AgentWithLoad[];
  allAgents: AgentWithLoad[];

  // legacy/default list (kept)
  agents: AgentWithLoad[];

  selectedTasks: Set<string>;
  selectedTasksOrder: string[];
  taskAssignments: TaskAssignment[];
  taskNotes: Record<string, string>;
  viewMode: "list" | "grid";
  onTaskSelection: (taskId: string, checked: boolean) => void;
  onSelectAllTasks: (taskIds: string[], checked: boolean) => void;
  onTaskAssignment: (
    taskId: string,
    agentId: string,
    isMultipleSelected: boolean,
    isFirstSelectedTask: boolean
  ) => void;
  onNoteChange: (taskId: string, note: string) => void;
  onViewModeChange: (mode: "list" | "grid") => void;

  titleOverride?: string;
  descriptionOverride?: string;
}

function displayName(a: Partial<Agent>) {
  return (
    (a as any)?.name ||
    `${(a as any)?.firstName ?? ""} ${(a as any)?.lastName ?? ""}`.trim() ||
    (a as any)?.email ||
    "Agent"
  );
}

function formatAgentLabel(
  a: Partial<AgentWithLoad>,
  activeCount = 0,
  weightedScore = 0,
  byStatus: Record<string, number> = {}
) {
  const p = byStatus["pending"] ?? 0;
  const ip = byStatus["in_progress"] ?? 0;
  const o = byStatus["overdue"] ?? 0;
  const r = byStatus["reassigned"] ?? 0;
  return `${displayName(
    a
  )} — ${activeCount} active (P:${p} | IP:${ip} | O:${o} | R:${r}) • W:${weightedScore}`;
}

export function TabContent({
  siteType,
  tasks,
  teamAgents,
  allAgents,
  agents,
  selectedTasks,
  selectedTasksOrder,
  taskAssignments,
  taskNotes,
  viewMode,
  onTaskSelection,
  onSelectAllTasks,
  onTaskAssignment,
  onNoteChange,
  onViewModeChange,
  titleOverride,
  descriptionOverride,
}: TabContentProps) {
  // normalize/label sort for each list
  const prep = (list: AgentWithLoad[]) => {
    const enriched = (list || []).map((a: any) => {
      const activeCount = a?.activeCount ?? 0;
      const weightedScore = a?.weightedScore ?? 0;
      const byStatus = a?.byStatus ?? {};
      const displayLabel =
        a?.displayLabel ??
        formatAgentLabel(
          a as AgentWithLoad,
          activeCount,
          weightedScore,
          byStatus
        );
      return {
        ...(a as Agent),
        activeCount,
        weightedScore,
        byStatus,
        displayLabel,
      } as AgentWithLoad;
    });

    enriched.sort(
      (x, y) =>
        (x.weightedScore ?? 0) - (y.weightedScore ?? 0) ||
        (x.activeCount ?? 0) - (y.activeCount ?? 0) ||
        displayName(x).localeCompare(displayName(y))
    );
    return enriched;
  };

  const agentsPrepared = useMemo(() => prep(agents), [agents]);
  const teamAgentsPrepared = useMemo(() => prep(teamAgents), [teamAgents]);
  const allAgentsPrepared = useMemo(() => prep(allAgents), [allAgents]);

  const selectedTasksInTab = tasks.filter((task) =>
    selectedTasks.has(task.id)
  ).length;
  const assignedTasksInTab = tasks.filter((task) =>
    taskAssignments.some((assignment) => assignment.taskId === task.id)
  ).length;

  const siteTypeConfig = {
    social_site: {
      title: "Social Media Tasks",
      description: "Manage social media content and engagement tasks",
      gradient: "from-violet-600 via-purple-600 to-fuchsia-600",
      bgGradient: "from-violet-100 via-purple-50 to-fuchsia-100",
      iconBg: "from-violet-500 to-purple-600",
    },
    web2_site: {
      title: "Web2 Platform Tasks",
      description: "Handle web2 platform content and management",
      gradient: "from-blue-600 via-cyan-600 to-sky-600",
      bgGradient: "from-blue-100 via-cyan-50 to-sky-100",
      iconBg: "from-blue-500 to-cyan-600",
    },
    other_asset: {
      title: "Other Asset Tasks",
      description: "Manage miscellaneous assets and content",
      gradient: "from-slate-600 via-gray-600 to-zinc-600",
      bgGradient: "from-slate-100 via-gray-50 to-zinc-100",
      iconBg: "from-slate-500 to-gray-600",
    },
  };

  const inferFromFirstTask =
    (tasks?.[0] as any)?.templateSiteAsset?.type ??
    (tasks?.[0] as any)?.siteType ??
    "other_asset";

  const isKnown = (t: string) => t in siteTypeConfig;
  const safeSiteType = isKnown(siteType)
    ? (siteType as keyof typeof siteTypeConfig)
    : isKnown(inferFromFirstTask)
    ? (inferFromFirstTask as keyof typeof siteTypeConfig)
    : "other_asset";

  const config = siteTypeConfig[safeSiteType];
  const IconComp =
    siteTypeIcons[safeSiteType as keyof typeof siteTypeIcons] ?? DefaultIcon;

  const finalTitle = titleOverride ?? config.title;
  const finalDescription = descriptionOverride ?? config.description;

  return (
    <div className="space-y-6">
      {/* header */}
      <div
        className={`rounded-2xl bg-gradient-to-r ${config.bgGradient} p-8 border-2 border-white shadow-xl`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-5">
            <div
              className={`p-4 rounded-2xl bg-gradient-to-r ${config.iconBg} text-white shadow-lg`}
            >
              <IconComp className="h-7 w-7" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {finalTitle}
              </h3>
              <p className="text-gray-700 font-medium">{finalDescription}</p>
            </div>
          </div>
          <div className="flex items-center space-x-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">
                {tasks.length}
              </div>
              <div className="text-sm text-gray-600 font-medium">
                Total Tasks
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-700">
                {selectedTasksInTab}
              </div>
              <div className="text-sm text-gray-600 font-medium">Selected</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-emerald-700">
                {assignedTasksInTab}
              </div>
              <div className="text-sm text-gray-600 font-medium">Assigned</div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-6">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onSelectAllTasks(
                  tasks.map((t) => t.id),
                  true
                )
              }
              disabled={tasks.length === 0}
              className={`bg-gradient-to-r ${config.gradient} text-white hover:text-gray-100 border-0 font-bold px-6 py-2.5`}
            >
              ✅ Select All ({tasks.length})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onSelectAllTasks(
                  tasks.map((t) => t.id),
                  false
                )
              }
              disabled={selectedTasksInTab === 0}
              className="bg-white text-gray-800 border-2 border-gray-400 font-bold px-6 py-2.5"
            >
              ❌ Deselect All
            </Button>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm font-bold text-gray-800">View Mode:</span>
            <div className="flex items-center bg-white rounded-xl p-1.5 border-2 border-gray-200">
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => onViewModeChange("list")}
                className="h-9 px-4 font-bold"
              >
                <List className="h-4 w-4 mr-2" />
                List
              </Button>
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => onViewModeChange("grid")}
                className="h-9 px-4 font-bold"
              >
                <Grid3X3 className="h-4 w-4 mr-2" />
                Grid
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* list/grid */}
      {tasks.length === 0 ? (
        <div className="bg-gradient-to-br from-white via-gray-50 to-slate-100 rounded-2xl border-2 border-gray-200 shadow-xl">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div
                className={`w-24 h-24 rounded-full bg-gradient-to-r ${config.iconBg} flex items-center justify-center mx-auto mb-8 shadow-2xl`}
              >
                <IconComp className="h-12 w-12 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-3">
                No {finalTitle} Found
              </h3>
              <p className="text-gray-600 font-medium">
                There are currently no tasks in this category for the selected
                client.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div
          className={
            viewMode === "grid"
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              : "space-y-4"
          }
        >
          {tasks.map((task) => {
            const isSelected = selectedTasks.has(task.id);
            const assignment = taskAssignments.find(
              (a) => a.taskId === task.id
            );
            const firstSelectedTaskId = selectedTasksOrder.find((id) =>
              selectedTasks.has(id)
            );
            const isFirstSelectedTask = firstSelectedTaskId === task.id;
            const isMultipleSelected = selectedTasks.size > 1;

            return viewMode === "grid" ? (
              <TaskCard
                key={task.id}
                task={task}
                siteType={safeSiteType}
                // NEW: give both pools to card
                teamAgents={teamAgentsPrepared as Agent[]}
                allAgents={allAgentsPrepared as Agent[]}
                // keep default list (unused now inside card)
                agents={agentsPrepared as Agent[]}
                isSelected={isSelected}
                assignment={assignment}
                isFirstSelectedTask={isFirstSelectedTask}
                isMultipleSelected={isMultipleSelected}
                onTaskSelection={onTaskSelection}
                onTaskAssignment={onTaskAssignment}
                note={taskNotes[task.id] || ""}
                onNoteChange={(note) => onNoteChange(task.id, note)}
              />
            ) : (
              <TaskListItem
                key={task.id}
                task={task}
                siteType={safeSiteType}
                // NEW
                teamAgents={teamAgentsPrepared as Agent[]}
                allAgents={allAgentsPrepared as Agent[]}
                // keep default list (unused now inside item)
                agents={agentsPrepared as Agent[]}
                isSelected={isSelected}
                assignment={assignment}
                isFirstSelectedTask={isFirstSelectedTask}
                isMultipleSelected={isMultipleSelected}
                note={taskNotes[task.id] || ""}
                onTaskSelection={onTaskSelection}
                onTaskAssignment={onTaskAssignment}
                onNoteChange={(note) => onNoteChange(task.id, note)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
