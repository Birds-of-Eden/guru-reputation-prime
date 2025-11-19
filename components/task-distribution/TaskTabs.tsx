"use client";

import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Globe, Building2, RefreshCw } from "lucide-react";
import { TabContent } from "./TabContent";
import { ReassignModal } from "./ReassignModal";
import {
  CategorizedTasks,
  Agent,
  TaskAssignment,
  Task,
} from "./distribution-types";
import { CiCircleRemove } from "react-icons/ci";

/**
 * Agent shape enriched with load stats (optional).
 */
type AgentWithLoad = Agent & {
  displayLabel?: string;
  activeCount?: number;
  weightedScore?: number;
  byStatus?: Record<string, number>;
};

interface TaskTabsProps {
  // 3-tab mode (Asset Creation)
  categorizedTasks?: CategorizedTasks;

  // Single-tab mode (for non–Asset Creation categories)
  singleTabTasks?: Task[];
  singleTabTitle?: string;

  // Agents
  agents: AgentWithLoad[];
  teamAgents?: AgentWithLoad[];
  allAgents?: AgentWithLoad[];

  // Shared state/handlers
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

  // ✅ NEW: Modal props from parent
  isReassignModalOpen: boolean;
  onReassignModalOpen: (open: boolean) => void;
  onReassign: (
    taskIds: string[],
    newAgentId: string,
    dueDate?: Date
  ) => Promise<void>;
  onUnassign: (taskIds: string[]) => Promise<void>;
  onRefresh?: () => void; // NEW: Refresh callback
  selectedTaskObjects: Task[];
}

/**
 * Small helper to normalize & sort agents by load (least → most).
 */
function prepAgents(list: AgentWithLoad[] = []) {
  const enriched = list.map((a) => ({
    ...a,
    activeCount: a.activeCount ?? 0,
    weightedScore: a.weightedScore ?? 0,
    byStatus: a.byStatus ?? {},
  }));
  enriched.sort(
    (x, y) =>
      (x.weightedScore ?? 0) - (y.weightedScore ?? 0) ||
      (x.activeCount ?? 0) - (y.activeCount ?? 0)
  );
  return enriched;
}

export function TaskTabs({
  categorizedTasks,
  singleTabTasks,
  singleTabTitle,
  agents,
  teamAgents = [],
  allAgents = [],
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
  // ✅ NEW: Modal props from parent
  isReassignModalOpen,
  onReassignModalOpen,
  onReassign,
  onUnassign,
  onRefresh,
  selectedTaskObjects,
}: TaskTabsProps) {
  const agentsWithLabels = useMemo(() => prepAgents(agents), [agents]);
  const teamAgentsWithLabels = useMemo(
    () => prepAgents(teamAgents),
    [teamAgents]
  );
  const allAgentsWithLabels = useMemo(() => prepAgents(allAgents), [allAgents]);

  // Helper function to check if any selected tasks have QC APPROVED status
  const hasQcApprovedTasks = () => {
    if (!selectedTaskObjects || selectedTasks.size === 0) return false;
    
    return Array.from(selectedTasks).some(taskId => {
      const task = selectedTaskObjects.find(t => t.id === taskId);
      return task?.status === "qc_approved";
    });
  };

  // -----------------------------
  // SINGLE-TAB MODE (e.g., Graphics Design / Blog Posting / etc.)
  // -----------------------------
  if (singleTabTasks) {
    return (
      <div className="w-full">
        {/* Simple header (no tabs) for single list */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-slate-300" />
            <h4 className="text-base md:text-lg font-semibold text-slate-900">
              {singleTabTitle ?? "Tasks"}
            </h4>
          </div>
          {selectedTasks.size > 0 && (
            <div className="flex gap-2">
              {/* Hide Un-Assign button if any selected tasks have QC APPROVED status */}
              {!hasQcApprovedTasks() && (
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-sky-600 text-white hover:text-gray-200 border-0 font-bold shadow-lg hover:shadow-xl transition-all duration-300"
                  onClick={async () => {
                    const selectedTaskIds = Array.from(selectedTasks);
                    await onUnassign(selectedTaskIds);
                    // Refresh the data after unassign
                    if (onRefresh) {
                      onRefresh();
                    }
                  }}
                >
                  <CiCircleRemove /> Un-Assign
                </Button>
              )}

              <Button
                onClick={() => onReassignModalOpen(true)}
                variant="outline"
                size="sm"
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white hover:text-gray-200 border-0 font-bold shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reassign ({selectedTasks.size})
              </Button>
            </div>
          )}
        </div>

        <TabContent
          siteType="single"
          tasks={singleTabTasks}
          // pass both pools so that TaskCard/TaskListItem can show per-row "Choose Agent List"
          teamAgents={teamAgentsWithLabels}
          allAgents={allAgentsWithLabels}
          agents={agentsWithLabels}
          selectedTasks={selectedTasks}
          selectedTasksOrder={selectedTasksOrder}
          taskAssignments={taskAssignments}
          taskNotes={taskNotes}
          viewMode={viewMode}
          onTaskSelection={onTaskSelection}
          onSelectAllTasks={onSelectAllTasks}
          onTaskAssignment={onTaskAssignment}
          onNoteChange={onNoteChange}
          onViewModeChange={onViewModeChange}
          titleOverride={`${singleTabTitle ?? "Tasks"} Tasks`}
          descriptionOverride={`Manage ${singleTabTitle ?? "these"} tasks`}
        />
      </div>
    );
  }

  // -----------------------------
  // 3-TAB MODE (Asset Creation)
  // -----------------------------
  if (categorizedTasks) {
    const safe = {
      social_site: categorizedTasks?.social_site ?? [],
      web2_site: categorizedTasks?.web2_site ?? [],
      other_asset: categorizedTasks?.other_asset ?? [],
    };

    // Professional tab styles (glass + active glow + focus ring)
    const baseTrigger =
      "group relative inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold " +
      "transition-all duration-300 ring-1 ring-transparent focus-visible:outline-none focus-visible:ring-2 " +
      "focus-visible:ring-blue-500 data-[state=inactive]:text-slate-600 hover:text-slate-900";

    const inactiveSkin =
      "bg-white/60 hover:bg-white/80 ring-slate-200 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md shadow-sm";

    const activeSkin =
      "bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white shadow-lg ring-0";

    const glow =
      "after:absolute after:inset-0 after:-z-10 after:rounded-2xl after:opacity-0 after:transition-opacity " +
      "after:duration-300 group-data-[state=active]:after:opacity-100 " +
      "group-data-[state=active]:after:shadow-[0_8px_30px_rgba(59,130,246,0.35)]";

    return (
      <div className="w-full">
        <Tabs defaultValue="social_site" className="w-full">
          {/* Tabs header */}
          <div className="relative mb-6">
            <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-r from-white via-slate-50 to-white" />
            <div className="relative rounded-3xl border border-slate-200/70 bg-white/60 p-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md shadow-sm">
              <TabsList
                className="grid grid-cols-1 gap-2 md:grid-cols-3 md:gap-3 bg-transparent p-0"
                aria-label="Asset Creation categories"
              >
                {/* Social Sites */}
                <TabsTrigger
                  value="social_site"
                  className={`${baseTrigger} ${inactiveSkin} ${glow} data-[state=active]:${activeSkin} data-[state=active]:text-white`}
                >
                  <span className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600/90 text-white p-1.5">
                      <Users className="h-4 w-4" aria-hidden />
                    </span>
                    <span>Social Sites</span>
                  </span>
                  <Badge
                    className="ml-1 rounded-full bg-white/70 text-slate-900 ring-1 ring-slate-200 group-data-[state=active]:bg-white group-data-[state=active]:text-slate-900"
                    variant="outline"
                  >
                    {safe.social_site.length}
                  </Badge>
                </TabsTrigger>

                {/* Web2 Sites */}
                <TabsTrigger
                  value="web2_site"
                  className={`${baseTrigger} ${inactiveSkin} ${glow} data-[state=active]:${activeSkin} data-[state=active]:text-white`}
                >
                  <span className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-cyan-600/90 text-white p-1.5">
                      <Globe className="h-4 w-4" aria-hidden />
                    </span>
                    <span>Web2 Sites</span>
                  </span>
                  <Badge
                    className="ml-1 rounded-full bg-white/70 text-slate-900 ring-1 ring-slate-200 group-data-[state=active]:bg-white group-data-[state=active]:text-slate-900"
                    variant="outline"
                  >
                    {safe.web2_site.length}
                  </Badge>
                </TabsTrigger>

                {/* Other Assets */}
                <TabsTrigger
                  value="other_asset"
                  className={`${baseTrigger} ${inactiveSkin} ${glow} data-[state=active]:${activeSkin} data-[state=active]:text-white`}
                >
                  <span className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center rounded-lg bg-gradient-to-br from-slate-600 to-zinc-700 text-white p-1.5">
                      <Building2 className="h-4 w-4" aria-hidden />
                    </span>
                    <span>Other Assets</span>
                  </span>
                  <Badge
                    className="ml-1 rounded-full bg-white/70 text-slate-900 ring-1 ring-slate-200 group-data-[state=active]:bg-white group-data-[state=active]:text-slate-900"
                    variant="outline"
                  >
                    {safe.other_asset.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          {/* Reassign Button for 3-tab mode */}
          {selectedTasks.size > 0 && (
            <div className="mb-4 flex justify-end gap-2">
              {/* Hide Un-Assign button if any selected tasks have QC APPROVED status */}
              {!hasQcApprovedTasks() && (
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-sky-600 text-white hover:text-gray-200 border-0 font-bold shadow-lg hover:shadow-xl transition-all duration-300"
                  onClick={async () => {
                    const selectedTaskIds = Array.from(selectedTasks);
                    await onUnassign(selectedTaskIds);
                    // Refresh the data after unassign
                    if (onRefresh) {
                      onRefresh();
                    }
                  }}
                >
                  <CiCircleRemove /> Un-Assign
                </Button>
              )}

              <Button
                onClick={() => onReassignModalOpen(true)}
                variant="outline"
                size="sm"
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white hover:text-white border-0 font-bold shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reassign ({selectedTasks.size})
              </Button>
            </div>
          )}

          {/* Tab panes */}
          <TabsContent value="social_site" className="mt-0">
            <TabContent
              siteType="social_site"
              tasks={safe.social_site}
              teamAgents={teamAgentsWithLabels}
              allAgents={allAgentsWithLabels}
              agents={agentsWithLabels}
              selectedTasks={selectedTasks}
              selectedTasksOrder={selectedTasksOrder}
              taskAssignments={taskAssignments}
              taskNotes={taskNotes}
              viewMode={viewMode}
              onTaskSelection={onTaskSelection}
              onSelectAllTasks={onSelectAllTasks}
              onTaskAssignment={onTaskAssignment}
              onNoteChange={onNoteChange}
              onViewModeChange={onViewModeChange}
            />
          </TabsContent>

          <TabsContent value="web2_site" className="mt-0">
            <TabContent
              siteType="web2_site"
              tasks={safe.web2_site}
              teamAgents={teamAgentsWithLabels}
              allAgents={allAgentsWithLabels}
              agents={agentsWithLabels}
              selectedTasks={selectedTasks}
              selectedTasksOrder={selectedTasksOrder}
              taskAssignments={taskAssignments}
              taskNotes={taskNotes}
              viewMode={viewMode}
              onTaskSelection={onTaskSelection}
              onSelectAllTasks={onSelectAllTasks}
              onTaskAssignment={onTaskAssignment}
              onNoteChange={onNoteChange}
              onViewModeChange={onViewModeChange}
            />
          </TabsContent>

          <TabsContent value="other_asset" className="mt-0">
            <TabContent
              siteType="other_asset"
              tasks={safe.other_asset}
              teamAgents={teamAgentsWithLabels}
              allAgents={allAgentsWithLabels}
              agents={agentsWithLabels}
              selectedTasks={selectedTasks}
              selectedTasksOrder={selectedTasksOrder}
              taskAssignments={taskAssignments}
              taskNotes={taskNotes}
              viewMode={viewMode}
              onTaskSelection={onTaskSelection}
              onSelectAllTasks={onSelectAllTasks}
              onTaskAssignment={onTaskAssignment}
              onNoteChange={onNoteChange}
              onViewModeChange={onViewModeChange}
            />
          </TabsContent>
        </Tabs>

        {/* Modal is now rendered at parent level */}
      </div>
    );
  }
}
