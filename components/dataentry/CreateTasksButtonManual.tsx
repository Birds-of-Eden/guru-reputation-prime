"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Target, Loader2 } from "lucide-react";

interface CreateTasksButtonProps {
  clientId: string;
  disabled?: boolean;
  onTaskCreationComplete?: () => void;
}

export default function CreateTasksManualButton({
  clientId,
  disabled = false,
  onTaskCreationComplete,
}: CreateTasksButtonProps) {
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [dueDate, setDueDate] = useState<string>("");
  const SITE_ASSET_TYPES = [
    "social_site",
    "web2_site",
    "other_asset",
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
  ] as const;
  type SiteAssetTypeLocal = (typeof SITE_ASSET_TYPES)[number];
  const [countsByType, setCountsByType] = useState<
    Partial<Record<SiteAssetTypeLocal, number>>
  >({});
  const [assetCountsByType, setAssetCountsByType] = useState<
    Partial<Record<SiteAssetTypeLocal, number>>
  >({});

  useEffect(() => {
    if (!open) return;
    // Fetch asset counts when dialog opens
    const fetchAssetCounts = async () => {
      try {
        const res = await fetch(
          `/api/tasks/create-dataentry-posting-tasks?clientId=${clientId}`
        );
        if (res.ok) {
          const data = await res.json();
          setAssetCountsByType(data.byType || {});
        }
      } catch (err) {
        console.error("Failed to fetch asset counts:", err);
      }
    };
    fetchAssetCounts();
  }, [open, clientId]);

  const createTasks = async () => {
    const total = Object.values(countsByType).reduce(
      (a, b) => a + Number(b || 0),
      0
    );
    if (total <= 0) {
      toast.info("Please enter at least one non-zero count.");
      return;
    }
    setIsCreating(true);
    try {
      const response = await fetch(
        "/api/tasks/create-dataentry-posting-tasks",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId, countsByType }),
        }
      );

      const data = await response.json().catch(() => ({ message: "" } as any));

      if (!response.ok)
        throw new Error(data?.message || "Failed to create tasks");

      const createdTasks: Array<{ id: string; dueDate?: string | null }> =
        Array.isArray(data?.tasks) ? data.tasks : [];
      const createdCount = Number(data?.created ?? createdTasks.length);

      // Auto-assign to current session user
      try {
        const meRes = await fetch(`/api/auth/me`, { cache: "no-store" });
        const me = await meRes.json().catch(() => ({} as any));
        const userId = me?.user?.id as string | undefined;

        if (!userId) {
          toast.warning(
            "Tasks created, but could not detect current user for assignment."
          );
        } else if (createdTasks.length === 0) {
          toast.info(
            data?.message || "No new tasks created (all counts were 0)"
          );
        } else {
          const assignments = createdTasks.map((t) => ({
            taskId: t.id,
            agentId: userId,
            note: "Auto-assigned to current user after manual generation",
            dueDate: (() => {
              if (dueDate && typeof dueDate === "string") {
                const d = new Date(dueDate + "T12:00:00");
                if (!Number.isNaN(d.getTime())) return d.toISOString();
              }
              if (t?.dueDate && typeof t.dueDate === "string") return t.dueDate;
              const d = new Date();
              d.setDate(d.getDate() + 7);
              return d.toISOString();
            })(),
          }));

          const distRes = await fetch(`/api/tasks/dataentry-distribute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientId, assignments }),
          });

          if (distRes.ok) {
            toast.success(
              data?.message ||
                `Created ${createdCount} task(s) and assigned to you`
            );
          } else {
            const djson = await distRes.json().catch(() => ({}));
            console.error("Assignment failed:", djson);
            toast.warning(
              `Created ${createdCount} task(s), but auto-assignment failed`
            );
          }
        }
      } catch (assignErr) {
        console.error(assignErr);
        toast.warning("Tasks created, but auto-assignment failed");
      }

      // Set localStorage flag to hide button after creation
      try {
        localStorage.setItem(`tasksCreated:${clientId}`, "1");
      } catch {}

      if (onTaskCreationComplete) onTaskCreationComplete();
      setOpen(false);
      window.location.reload();
    } catch (error: any) {
      console.error("Error creating tasks:", error);
      toast.error(error.message || "Failed to create tasks");
    } finally {
      setIsCreating(false);
    }
  };

  // Check localStorage to hide button if tasks already created
  const [tasksAlreadyCreated, setTasksAlreadyCreated] = useState(false);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && clientId) {
        const v = localStorage.getItem(`tasksCreated:${clientId}`);
        setTasksAlreadyCreated(!!v);
      }
    } catch {
      setTasksAlreadyCreated(false);
    }
  }, [clientId]);

  // Don't render if tasks already created
  if (tasksAlreadyCreated) {
    return null;
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        disabled={isCreating || disabled}
        size="sm"
        className={`bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md ${
          disabled ? "opacity-50 cursor-not-allowed" : ""
        }`}
        title={
          disabled
            ? "Tasks already created"
            : "Create posting tasks for this client (button will hide after creation)"
        }
      >
        {isCreating ? (
          <>
            <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
            Creating...
          </>
        ) : (
          <>
            <Target className="h-3 w-3 mr-1.5" />
            Create Tasks
          </>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-gray-50 flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
                <Target className="w-5 h-5 text-white" />
              </div>
              Task Generator Estiak
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Select asset types and specify how many cycles to create. Each
              cycle creates tasks for all assets of that type (e.g., 5 cycles ×
              10 assets = 50 tasks).
            </DialogDescription>
          </DialogHeader>

          {/* Summary Card - Fixed position */}
          <div className="px-6 pt-4">
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-white dark:bg-gray-800 rounded-lg">
                    <svg
                      className="w-5 h-5 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                  </div>
                  <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                    Total Tasks to Create
                  </span>
                </div>
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {Object.entries(countsByType).reduce(
                    (acc, [, v]) => acc + Number(v || 0),
                    0
                  )}
                </span>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <Label
                  htmlFor="manual-due-date"
                  className="text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  Due date for new tasks
                </Label>
                <Input
                  id="manual-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-8 w-40 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Scrollable Asset Type List */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-2">
              {SITE_ASSET_TYPES.map((type) => (
                <div
                  key={type}
                  className="group flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex-1">
                    <Label className="font-medium text-gray-700 dark:text-gray-300 text-sm cursor-pointer capitalize">
                      {type.replace(/_/g, " ")}
                    </Label>
                    {assetCountsByType[type] ? (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {assetCountsByType[type]} asset
                        {assetCountsByType[type] !== 1 ? "s" : ""}
                        {countsByType[type] ? (
                          <span className="font-semibold text-blue-600 dark:text-blue-400 ml-1">
                            →{" "}
                            {(countsByType[type] || 0) *
                              (assetCountsByType[type] || 0)}{" "}
                            tasks
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 p-0 rounded-full border-2 hover:bg-red-50 hover:border-red-300 dark:hover:bg-red-900/20 disabled:opacity-30"
                      onClick={() =>
                        setCountsByType((prev) => ({
                          ...prev,
                          [type]: Math.max(0, (prev[type] || 0) - 1),
                        }))
                      }
                      disabled={(countsByType[type] || 0) <= 0}
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M20 12H4"
                        />
                      </svg>
                    </Button>

                    <Input
                      type="number"
                      min={0}
                      className="w-20 text-center font-semibold text-lg border-2 focus:border-blue-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={countsByType[type] ?? 0}
                      onChange={(e) =>
                        setCountsByType((prev) => ({
                          ...prev,
                          [type]: Math.max(0, Number(e.target.value) || 0),
                        }))
                      }
                    />

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 p-0 rounded-full border-2 hover:bg-green-50 hover:border-green-300 dark:hover:bg-green-900/20"
                      onClick={() =>
                        setCountsByType((prev) => ({
                          ...prev,
                          [type]: (prev[type] || 0) + 1,
                        }))
                      }
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fixed Footer with Quick Actions and Buttons */}
          <div className="px-6 pb-6 pt-4 border-t bg-gray-50 dark:bg-gray-900/50">
            {/* Quick Actions */}
            <div className="flex gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCountsByType({})}
                className="flex-1 h-10 font-medium hover:bg-red-50 hover:border-red-300 dark:hover:bg-red-900/20"
              >
                <svg
                  className="h-4 w-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Clear All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const allOnes = SITE_ASSET_TYPES.reduce((acc, type) => {
                    acc[type] = 1;
                    return acc;
                  }, {} as Record<string, number>);
                  setCountsByType(allOnes);
                }}
                className="flex-1 h-10 font-medium hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-900/20"
              >
                <svg
                  className="h-4 w-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Set All to 1
              </Button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                className="flex-1 h-11 font-semibold"
              >
                Cancel
              </Button>
              <Button
                onClick={createTasks}
                disabled={
                  isCreating ||
                  Object.values(countsByType).every(
                    (count) => !count || count === 0
                  )
                }
                className="flex-1 h-11 font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Creating Tasks...
                  </>
                ) : (
                  <>
                    <Target className="h-5 w-5 mr-2" />
                    Create Tasks
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
