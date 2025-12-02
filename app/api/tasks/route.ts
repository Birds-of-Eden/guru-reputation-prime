// app/api/tasks/route.ts

import { NextResponse } from "next/server";
import { startOfDay, endOfDay } from "date-fns";
import prisma from "@/lib/prisma";

// ========== READ TASKS WITH DATE RANGE & FILTERS ==========
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const clientId = searchParams.get("clientId");
    const packageId = searchParams.get("packageId");
    const status = searchParams.get("status");
    const assignedToId = searchParams.get("assignedToId");

    const where: any = {};

    // ----- Date Range -----
    if (startDate && endDate) {
      where.dueDate = {
        gte: startOfDay(new Date(startDate)),
        lte: endOfDay(new Date(endDate)),
      };
    }

    // ----- Client Filter -----
    if (clientId) {
      where.clientId = clientId;
    }

    // ----- Package Filter (via client relation) -----
    if (packageId) {
      where.client = { packageId };
    }

    // ----- Status Filter -----
    if (status) {
      where.status = status;
    }

    // ----- Assigned User Filter -----
    if (assignedToId) {
      where.assignedToId = assignedToId;
    }

    // Fetch tasks efficiently
    const tasks = await prisma.task.findMany({
      where,
      select: {
        id: true,
        name: true,
        status: true,
        priority: true,
        dueDate: true,
        createdAt: true,
        updatedAt: true,
        notes: true,
        idealDurationMinutes: true,
        actualDurationMinutes: true,
        performanceRating: true,
        completionLink: true,
        completedAt: true,
        qcTotalScore: true,
        qcReview: true,
        client: { select: { id: true, name: true, packageId: true } },
        category: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 100, // ✅ limit (add pagination later if needed)
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}
