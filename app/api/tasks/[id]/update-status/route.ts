// app/api/tasks/[id]/update-status/route.ts
// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { TaskStatus } from "@prisma/client";

/**
 * 🎯 Update Task Status with Auto-Triggers
 * 
 * Special behavior:
 * - When QC task status → completed: Auto-trigger posting task generation
 * 
 * PATCH /api/tasks/{taskId}/update-status
 * Body: { 
 *   status: TaskStatus,
 *   actorId?: string,
 *   notes?: string,
 *   autoTriggerPosting?: boolean (default: true for QC tasks)
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    const body = await request.json();
    const {
      status,
      actorId,
      notes,
      autoTriggerPosting = true,
    } = body as {
      status: TaskStatus;
      actorId?: string;
      notes?: string;
      autoTriggerPosting?: boolean;
    };

    if (!status) {
      return NextResponse.json(
        { message: "status is required" },
        { status: 400 }
      );
    }

    // Validate status enum
    if (!Object.values(TaskStatus).includes(status)) {
      return NextResponse.json(
        { message: "Invalid status value" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1) Load current task
      const currentTask = await tx.task.findUnique({
        where: { id: taskId },
        include: {
          category: true,
          templateSiteAsset: true,
          assignment: {
            include: {
              client: true,
            },
          },
        },
      });

      if (!currentTask) {
        throw new Error("TASK_NOT_FOUND");
      }

      const oldStatus = currentTask.status;
      
      // Check if this is a QC task being completed
      const isQcTask = 
        currentTask.category?.name?.toLowerCase().includes("qc") ||
        currentTask.category?.name?.toLowerCase().includes("quality");
      
      const isCompleting = oldStatus !== TaskStatus.completed && status === TaskStatus.completed;

      // 2) Update task status
      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: {
          status,
          notes: notes ? `${currentTask.notes || ""}\n\n${notes}` : currentTask.notes,
        },
        include: {
          category: true,
          templateSiteAsset: true,
          assignment: {
            include: {
              client: true,
            },
          },
        },
      });

      // 3) Activity log
      await tx.activityLog.create({
        data: {
          id: crypto.randomUUID(),
          entityType: "Task",
          entityId: taskId,
          userId: actorId || null,
          action: "update_status",
          details: {
            taskId,
            taskName: currentTask.name,
            oldStatus,
            newStatus: status,
            assignmentId: currentTask.assignmentId,
            clientId: currentTask.clientId,
            clientName: currentTask.assignment?.client?.name,
            isQcTask,
          },
        },
      });

      return {
        task: updatedTask,
        statusChange: {
          from: oldStatus,
          to: status,
        },
        isQcTask,
        isCompleting,
      };
    });

    // 4) Auto-trigger posting task generation if conditions met
    let postingResult: any = null;
    let postingTriggered = false;
    
    if (result.isQcTask && result.isCompleting && autoTriggerPosting) {
      try {
        // Trigger posting task generation
        const response = await fetch(
          `${request.nextUrl.origin}/api/tasks/${taskId}/trigger-posting`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-user-id": actorId || "",
              "x-actor-id": actorId || "",
            },
            body: JSON.stringify({
              actorId,
              forceOverride: false,
            }),
          }
        );

        if (response.ok) {
          postingResult = await response.json();
          postingTriggered = true;
          console.log(
            `✅ Auto-triggered posting for QC task ${taskId}:`,
            postingResult.postingTasks?.length || 0,
            "tasks created"
          );
        } else {
          const errorData = await response.json();
          console.warn(
            `⚠️ Failed to auto-trigger posting for task ${taskId}:`,
            errorData.message
          );
          // Don't fail the whole request if posting fails
        }
      } catch (error) {
        console.error("Error auto-triggering posting:", error);
        // Don't fail the whole request if posting fails
      }
    }

    return NextResponse.json(
      {
        message: "Task status updated successfully",
        task: result.task,
        statusChange: result.statusChange,
        autoTrigger: {
          isQcTask: result.isQcTask,
          postingTriggered,
          postingResult: postingTriggered ? postingResult : null,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    if (error?.message === "TASK_NOT_FOUND") {
      return NextResponse.json(
        { message: "Task not found" },
        { status: 404 }
      );
    }
    console.error("Update status error:", error);
    return NextResponse.json(
      {
        message: "Failed to update task status",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tasks/{taskId}/update-status
 * Get current task status and preview what auto-triggers would fire
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        category: true,
        templateSiteAsset: true,
        assignment: {
          include: {
            client: true,
            siteAssetSettings: true,
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json(
        { message: "Task not found" },
        { status: 404 }
      );
    }

    const isQcTask =
      task.category?.name?.toLowerCase().includes("qc") ||
      task.category?.name?.toLowerCase().includes("quality");

    let postingPreview = null;
    if (isQcTask && task.templateSiteAssetId) {
      const assetSetting = task.assignment?.siteAssetSettings?.find(
        (s) => s.templateSiteAssetId === task.templateSiteAssetId
      );

      const requiredFrequency =
        assetSetting?.requiredFrequency ??
        task.templateSiteAsset?.defaultPostingFrequency ??
        4;

      postingPreview = {
        wouldTriggerPosting: task.status !== TaskStatus.completed,
        postingTasksToCreate: requiredFrequency,
        clientOverride: !!assetSetting,
      };
    }

    return NextResponse.json({
      task: {
        id: task.id,
        name: task.name,
        status: task.status,
        categoryName: task.category?.name,
      },
      isQcTask,
      autoTriggers: {
        postingPreview,
      },
    });
  } catch (error: any) {
    console.error("Get status error:", error);
    return NextResponse.json(
      {
        message: "Failed to get task status",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
