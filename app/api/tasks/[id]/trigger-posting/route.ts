// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { TaskStatus, TaskPriority, PeriodType } from "@prisma/client";
import { randomUUID } from "crypto";
import { calculateTaskDueDate } from "@/utils/working-days";
import { differenceInCalendarDays, addDays, isWeekend } from "date-fns";

const CAT_SOCIAL_ACTIVITY = "Social Activity";
const CAT_BLOG_POSTING = "Blog Posting";
const ALLOWED_ASSET_TYPES = ["social_site", "web2_site", "other_asset"] as const;

function resolveCategoryFromType(assetType?: string): string {
  if (assetType === "web2_site") return CAT_BLOG_POSTING;
  return CAT_SOCIAL_ACTIVITY;
}

// ---------- GET: Preview (minimal) ----------
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;
  try {
    const qcTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignment: {
          include: {
            client: { select: { dueDate: true, startDate: true, package: { select: { totalMonths: true } } } },
            siteAssetSettings: true,
          },
        },
        templateSiteAsset: true,
      },
    });

    if (!qcTask) return NextResponse.json({ message: "Task not found" }, { status: 404 });
    if (!qcTask.templateSiteAssetId) return NextResponse.json({ message: "Task has no linked site asset" }, { status: 400 });

    const setting = qcTask.assignment?.siteAssetSettings?.find(
      (s) => s.templateSiteAssetId === qcTask.templateSiteAssetId
    );
    const requiredFrequency =
      setting?.requiredFrequency ?? qcTask.templateSiteAsset?.defaultPostingFrequency ?? 4;

    const dueDate = qcTask.assignment?.client?.dueDate ?? qcTask.dueDate ?? null;

    return NextResponse.json({
      qcTask: { id: qcTask.id, name: qcTask.name, status: qcTask.status, dueDate },
      preview: { requiredFrequency },
    });
  } catch (error: any) {
    console.error("Preview posting error:", error);
    return NextResponse.json(
      { message: "Failed to preview posting tasks", error: error.message },
      { status: 500 }
    );
  }
}

function addWorkingDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (!isWeekend(result)) added++;
  }
  return result;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const { frequency = 3, startDate } = body as {
      frequency: number;
      startDate: string;
    };

    // === 1️⃣ Load source task with client due date ===
    const qcTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignment: {
          include: {
            client: true,
          },
        },
        templateSiteAsset: true,
        category: true,
      },
    });

    if (!qcTask) {
      return NextResponse.json({ message: "Task not found" }, { status: 404 });
    }
    if (!qcTask.assignmentId || !qcTask.templateSiteAssetId) {
      return NextResponse.json(
        { message: "Task missing assignment or asset" },
        { status: 400 }
      );
    }

    const assetType = qcTask.templateSiteAsset?.type;
    if (!assetType || !ALLOWED_ASSET_TYPES.includes(assetType as any)) {
      return NextResponse.json({ message: "Invalid asset type" }, { status: 400 });
    }

    const clientDueDate = qcTask.assignment?.client?.dueDate;
    if (!clientDueDate) {
      return NextResponse.json(
        { message: "Client has no due date set" },
        { status: 400 }
      );
    }

    const start = new Date(startDate || qcTask.createdAt);
    const due = new Date(clientDueDate);

    // === 2️⃣ Compute total months between start and due ===
    const totalDays = Math.max(1, differenceInCalendarDays(due, start));
    const totalMonths = Math.ceil(totalDays / 30);
    const totalTasks = frequency * totalMonths;

    // === 3️⃣ Determine category ===
    const categoryName = resolveCategoryFromType(assetType);
    const category = await prisma.taskCategory.upsert({
      where: { name: categoryName },
      update: {},
      create: { name: categoryName },
    });

    // === 4️⃣ Create posting tasks ===
    const postingTasks = [];
    const anchor = new Date(start);
    const plannedTotal = totalTasks;
    const endDue = new Date(clientDueDate);

    for (let i = 1; i <= plannedTotal; i++) {
      const due = calculateTaskDueDate(anchor, i);
      if (endDue && due > endDue) break;
      const task = await prisma.task.create({
        data: {
          id: randomUUID(),
          name: `${qcTask.templateSiteAsset?.name || "Asset"} - ${i}`,
          assignmentId: qcTask.assignmentId,
          clientId: qcTask.clientId,
          templateSiteAssetId: qcTask.templateSiteAssetId,
          categoryId: category.id,
          dueDate: due.toISOString(),
          status: TaskStatus.pending,
          priority: TaskPriority.medium,
          idealDurationMinutes:
            qcTask.templateSiteAsset?.defaultIdealDurationMinutes ?? 30,
          notes: `[AUTO-GENERATED] Posting ${i + 1}/${totalTasks}
Frequency: ${frequency}/month × ${totalMonths} months
Client Due: ${endDue.toDateString()}
Spacing: every 7 working days`,
        },
        select: { id: true, name: true, dueDate: true },
      });

      postingTasks.push(task);
    }

    // === 5️⃣ Update QC task note ===
    await prisma.task.update({
      where: { id: qcTask.id },
      data: {
        notes: `${
          qcTask.notes || ""
        }\n\n[POSTING GENERATED] ${postingTasks.length} ${categoryName} tasks created for asset ${
          qcTask.templateSiteAsset?.name
        }. Start: ${start.toDateString()} → Due: ${due.toDateString()}`,
      },
    });

    return NextResponse.json(
      {
        message: `✅ Created ${postingTasks.length} ${categoryName} tasks`,
        startDate: start,
        dueDate: due,
        months: totalMonths,
        postingTasks,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("Trigger posting error:", err);
    return NextResponse.json(
      { message: "Failed to trigger posting tasks", error: err.message },
      { status: 500 }
    );
  }
}
