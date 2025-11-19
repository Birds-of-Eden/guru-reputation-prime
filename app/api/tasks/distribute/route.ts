// app/api/tasks/distribute/route.ts

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      clientId,
      assignments,
    }: {
      clientId: string;
      // UI sends the same ISO date for each item, but we accept per-assignment dueDate
      assignments: {
        taskId: string;
        agentId: string;
        note?: string;
        dueDate?: string;
      }[];
    } = body;

    if (!clientId || !assignments || !Array.isArray(assignments)) {
      return NextResponse.json(
        { message: "Invalid request data" },
        { status: 400 }
      );
    }

    // OPTIMIZATION (batched counter updates): pre-compute increments per agent for efficient upserts.
    const agentAssignmentCounts = assignments.reduce<Map<string, number>>(
      (map, { agentId }) => map.set(agentId, (map.get(agentId) ?? 0) + 1),
      new Map()
    );

    // Run everything atomically
    const result = await prisma.$transaction(async (tx) => {
      // 1) Update each task (agent/status/notes/dueDate)
      const updatePromises = assignments.map(
        ({ taskId, agentId, note, dueDate }) => {
          let parsedDue: Date | null = null;
          if (dueDate) {
            const d = new Date(dueDate);
            if (!isNaN(d.getTime())) parsedDue = d;
          }

          return tx.task.update({
            where: { id: taskId },
            data: {
              assignedToId: agentId,
              status: "pending", // reset when (re)assigning
              notes: note || "",
              ...(parsedDue ? { dueDate: parsedDue } : {}), // ✅ write due date
              updatedAt: new Date(),
            },
          });
        }
      );

      const updatedTasks = await Promise.all(updatePromises);

      // 2) Activity logs (include due date for traceability)
      const activityLogPromises = assignments.map(
        ({ taskId, agentId, dueDate }) =>
          tx.activityLog.create({
            data: {
              id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
              entityType: "Task",
              entityId: taskId,
              userId: agentId,
              action: "task_assigned",
              details: {
                clientId,
                assignedAt: new Date().toISOString(),
                assignedBy: "system",
                ...(dueDate ? { dueDate } : {}),
              },
            },
          })
      );
      await Promise.all(activityLogPromises);

      // 3) Update/initialize ClientTeamMember counters
      await Promise.all(
        Array.from(agentAssignmentCounts.entries()).map(([agentId, count]) =>
          tx.clientTeamMember.upsert({
            where: { clientId_agentId: { clientId, agentId } },
            update: { assignedTasks: { increment: count } },
            create: {
              clientId,
              agentId,
              assignedTasks: count,
              assignedDate: new Date(),
            },
          })
        )
      );

      return updatedTasks;
    });

    // 4) Notifications (mention due date if present)
    const notificationPromises = assignments.map(
      ({ taskId, agentId, dueDate }) =>
        prisma.notification.create({
          data: {
            userId: agentId,
            taskId,
            type: "general",
            message: `You have been assigned a new task${
              dueDate ? ` (due ${new Date(dueDate).toLocaleDateString()})` : ""
            }.`,
            createdAt: new Date(),
          },
        })
    );
    await Promise.all(notificationPromises);

    return NextResponse.json({
      message: "Tasks distributed successfully",
      assignedTasks: result.length,
      assignments,
    });
  } catch (error) {
    console.error("Error distributing tasks:", error);
    return NextResponse.json(
      {
        message: "Failed to distribute tasks",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    // ---------- who is doing it (optional) ----------
    let reassignedBy: string | null = null;
    if (body.reassignedById || body.reassignedByEmail) {
      const user = await prisma.user.findUnique({
        where: body.reassignedById
          ? { id: body.reassignedById }
          : { email: body.reassignedByEmail },
        select: { id: true, email: true },
      });
      reassignedBy = user?.id ?? user?.email ?? null;
    }

    // ---------- SINGLE-TASK SHAPE ----------
    if (body.taskId && (body.newAgentId !== undefined)) {
      const { taskId, newAgentId, reassignNotes } = body as {
        taskId: string;
        newAgentId: string | null;
        reassignNotes?: string;
      };

      // load the task to know fromAgent & clientId
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { id: true, assignedToId: true, clientId: true },
      });
      if (!task) {
        return NextResponse.json(
          { message: "Task not found" },
          { status: 404 }
        );
      }

      const fromAgentId = task.assignedToId;
      const toAgentId = newAgentId;
      const clientId = task.clientId;

      await prisma.$transaction(async (tx) => {
        // update task
        await tx.task.update({
          where: { id: taskId },
          data: {
            assignedToId: toAgentId,
            status: "pending",
            reassignNotes: reassignNotes ?? "",
            actualDurationMinutes: null,
            completionLink: null,
            completedAt: null,
            updatedAt: new Date(),
          },
        });

        // activity log
        await tx.activityLog.create({
          data: {
            id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            entityType: "Task",
            entityId: taskId,
            userId: toAgentId, // This will be null for unassigned tasks
            action: toAgentId ? "task_reassigned" : "task_unassigned",
            details: {
              clientId,
              reassignedAt: new Date().toISOString(),
              reassignedTo: toAgentId,
              reassignedFrom: fromAgentId ?? null,
              reassignedBy: reassignedBy ?? "system",
              reassignNotes: reassignNotes ?? null,
            },
          },
        });

        // ... existing counter logic ...
        if (clientId) {
          if (fromAgentId && fromAgentId !== toAgentId) {
            await tx.clientTeamMember.updateMany({
              where: {
                clientId,
                agentId: fromAgentId,
                assignedTasks: { gt: 0 },
              },
              data: { assignedTasks: { decrement: 1 } },
            });
          }
          // Only increment counter if toAgentId is not null (i.e., assigning to someone)
          if (toAgentId) {
            await tx.clientTeamMember.upsert({
              where: { clientId_agentId: { clientId, agentId: toAgentId } },
              update: { assignedTasks: { increment: 1 } },
              create: {
                clientId,
                agentId: toAgentId,
                assignedTasks: 1,
                assignedDate: new Date(),
              },
            });
          }
        }
      });

      // ... existing notification logic ...
      const notifs: Promise<any>[] = [];
      
      // Only create notification for the new assignee if toAgentId is not null
      if (toAgentId) {
        notifs.push(
          prisma.notification.create({
            data: {
              userId: toAgentId,
              taskId,
              type: "general",
              message: "A task has been reassigned to you.",
              createdAt: new Date(),
            },
          })
        );
      }
      
      // Always notify the previous assignee if they exist and are different from the new assignee
      if (fromAgentId && fromAgentId !== toAgentId) {
        notifs.push(
          prisma.notification.create({
            data: {
              userId: fromAgentId,
              taskId,
              type: "general",
              message: toAgentId 
                ? "A task previously assigned to you has been reassigned."
                : "A task previously assigned to you has been unassigned.",
              createdAt: new Date(),
            },
          })
        );
      }
      await Promise.all(notifs);

      return NextResponse.json({
        message: "Task reassigned",
        taskId,
        reassignedFrom: fromAgentId ?? null,
        reassignedTo: toAgentId,
      });
    }

    // ---------- BULK SHAPE ----------
    if (Array.isArray(body.reassignments) && body.reassignments.length) {
      const { clientId, reassignments } = body as {
        clientId: string;
        reassignments: {
          taskId: string;
          toAgentId: string;
          reassignNotes?: string;
        }[];
      };

      // ... existing bulk reassignment logic remains the same ...
      const taskIds = [...new Set(reassignments.map((r) => r.taskId))];
      const existingTasks = await prisma.task.findMany({
        where: { id: { in: taskIds } },
        select: { id: true, assignedToId: true },
      });
      const map = new Map(existingTasks.map((t) => [t.id, t.assignedToId]));

      await prisma.$transaction(async (tx) => {
        // update tasks
        await Promise.all(
          reassignments.map(({ taskId, toAgentId, reassignNotes }) =>
            tx.task.update({
              where: { id: taskId },
              data: {
                assignedToId: toAgentId,
                status: "pending",
                reassignNotes: reassignNotes ?? "",
                actualDurationMinutes: null,
                completionLink: null,
                completedAt: null,
                updatedAt: new Date(),
              },
            })
          )
        );

        // logs
        await Promise.all(
          reassignments.map(({ taskId, toAgentId, reassignNotes }) =>
            tx.activityLog.create({
              data: {
                id: `log_${Date.now()}_${Math.random()
                  .toString(36)
                  .slice(2, 9)}`,
                entityType: "Task",
                entityId: taskId,
                userId: toAgentId, // This will be null for unassigned tasks
                action: toAgentId ? "task_reassigned" : "task_unassigned",
                details: {
                  clientId,
                  reassignedAt: new Date().toISOString(),
                  reassignedTo: toAgentId,
                  reassignedFrom: map.get(taskId) ?? null,
                  reassignedBy: reassignedBy ?? "system",
                  reassignNotes: reassignNotes ?? null,
                },
              },
            })
          )
        );

        if (clientId) {
          // OPTIMIZATION (delta map counters): adjust team-member counters in one pass instead of per-task queries.
          const deltaMap = new Map<string, number>();
          for (const { taskId, toAgentId } of reassignments) {
            const previous = map.get(taskId);
            if (previous && previous !== toAgentId) {
              deltaMap.set(previous, (deltaMap.get(previous) ?? 0) - 1);
            }
            // Only increment for non-null toAgentId (i.e., when assigning to someone)
            if (toAgentId) {
              deltaMap.set(toAgentId, (deltaMap.get(toAgentId) ?? 0) + 1);
            }
          }

          const increments = Array.from(deltaMap.entries()).filter(
            ([, delta]) => delta > 0
          );
          const decrements = Array.from(deltaMap.entries()).filter(
            ([, delta]) => delta < 0
          );

          let existingMembers: { agentId: string; assignedTasks: number | null }[] =
            [];
          if (decrements.length) {
            existingMembers = await tx.clientTeamMember.findMany({
              where: {
                clientId,
                agentId: { in: decrements.map(([agentId]) => agentId) },
              },
              select: { agentId: true, assignedTasks: true },
            });
          }
          const assignedMap = new Map(
            existingMembers.map((m) => [m.agentId, m.assignedTasks ?? 0])
          );

          await Promise.all([
            ...increments.map(([agentId, delta]) =>
              tx.clientTeamMember.upsert({
                where: { clientId_agentId: { clientId, agentId } },
                update: { assignedTasks: { increment: delta } },
                create: {
                  clientId,
                  agentId,
                  assignedTasks: delta,
                  assignedDate: new Date(),
                },
              })
            ),
            ...decrements.map(([agentId, delta]) => {
              const available = assignedMap.get(agentId) ?? 0;
              const amount = Math.min(available, Math.abs(delta));
              if (amount <= 0) return Promise.resolve();
              return tx.clientTeamMember.update({
                where: { clientId_agentId: { clientId, agentId } },
                data: { assignedTasks: { decrement: amount } },
              });
            }),
          ]);
        }
      });

      return NextResponse.json({
        message: "Tasks re-distributed",
        summary: { updatedTasks: reassignments.length },
      });
    }

    // shape didn't match
    return NextResponse.json(
      { message: "Invalid request data" },
      { status: 400 }
    );
  } catch (err) {
    console.error("Error re-distributing tasks:", err);
    return NextResponse.json(
      {
        message: "Failed to re-distribute tasks",
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
