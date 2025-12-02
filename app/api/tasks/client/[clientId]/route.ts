// app/api/tasks/client/[clientId]/route.ts

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;

    const tasks = await prisma.task.findMany({
      where: { clientId },
      // OPTIMIZATION (lean select): avoid pulling unused columns to keep payload tight for distribution UI.
      select: {
        id: true,
        name: true,
        status: true,
        priority: true,
        dueDate: true,
        createdAt: true,
        updatedAt: true,
        notes: true,
        reassignNotes: true,
        idealDurationMinutes: true,
        qcTotalScore: true,
        qcReview: true,
        templateSiteAsset: {
          select: {
            id: true,
            name: true,
            type: true,
            description: true,
            url: true,
            isRequired: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            image: true,
            category: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
            company: true,
            imageDrivelink: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { templateSiteAsset: { type: "asc" } },
        { priority: "desc" },
        { dueDate: "asc" },
      ],
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error("Error fetching client tasks:", error);
    return NextResponse.json(
      { message: "Failed to fetch client tasks" },
      { status: 500 }
    );
  }
}
