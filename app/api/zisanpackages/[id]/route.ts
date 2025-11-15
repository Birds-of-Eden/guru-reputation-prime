// app/api/zisanpackages/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logActivity } from "@/lib/logActivity";
import { diffChanges, sanitizePackage } from "@/utils/audit";

// ✅ GET Package by ID (no audit)
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const pkg = await prisma.package.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        totalMonths: true,
        _count: {
          select: {
            clients: true,
            templates: true,
          },
        },
      },
    });

    if (!pkg) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    return NextResponse.json(pkg);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch package" },
      { status: 500 }
    );
  }
}

// ✅ PUT - Update Package (with audit log)
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const body = await req.json();
    const { name, description, type, totalMonths } = body;
    const actorId =
      (typeof body.actorId === "string" && body.actorId) ||
      (typeof (req.headers.get("x-actor-id") || "") === "string" &&
        (req.headers.get("x-actor-id") as string)) ||
      null;

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.package.findUnique({ where: { id } });
      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      const pkg = await tx.package.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(description !== undefined
            ? { description: description || null }
            : {}),
          ...(type !== undefined ? { type } : {}),
          ...(totalMonths !== undefined ? { totalMonths } : {}),
        },
      });

      // diff only changed fields
      const changes = diffChanges(
        sanitizePackage(existing),
        sanitizePackage(pkg),
        ["updatedAt", "createdAt"]
      );

      await tx.activityLog.create({
        data: {
          id: crypto.randomUUID(),
          entityType: "Package",
          entityId: pkg.id,
          userId: actorId,
          action: "update",
          details: { changes },
        },
      });

      return pkg;
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error?.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }
    console.error("Update failed", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

// ✅ DELETE - Delete Package (with audit log) -- Faysal Created this on 25/09/25
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: packageId } = await context.params;

  try {
    const actorId =
      (req.nextUrl.searchParams.get("actorId") as string | null) ??
      (req.headers.get("x-actor-id") as string | null) ??
      null;

    console.log(
      `[Package Delete Cascade] START packageId=${packageId}, actorId=${
        actorId || "null"
      }`
    );

    await prisma.$transaction(async (tx) => {
      // Ensure package exists first (so we can log a nice 404 outside)
      const existing = await tx.package.findUnique({
        where: { id: packageId },
        select: { id: true, name: true, description: true },
      });
      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      // --- Your raw SQL cascade sequence (parameterized) ---
      // 1) Comments of tasks in this package
      await tx.$executeRaw`
        DELETE FROM "Comment"
        WHERE "taskId" IN (
          SELECT t."id"
          FROM "Task" t
          JOIN "Assignment" a ON a."id" = t."assignmentId"
          JOIN "Template" tp ON tp."id" = a."templateId"
          WHERE tp."packageId" = ${packageId}
        );
      `;

      // 2) Reports of tasks in this package
      await tx.$executeRaw`
        DELETE FROM "Report"
        WHERE "taskId" IN (
          SELECT t."id"
          FROM "Task" t
          JOIN "Assignment" a ON a."id" = t."assignmentId"
          JOIN "Template" tp ON tp."id" = a."templateId"
          WHERE tp."packageId" = ${packageId}
        );
      `;

      // 3) Notifications of tasks in this package
      await tx.$executeRaw`
        DELETE FROM "Notification"
        WHERE "taskId" IN (
          SELECT t."id"
          FROM "Task" t
          JOIN "Assignment" a ON a."id" = t."assignmentId"
          JOIN "Template" tp ON tp."id" = a."templateId"
          WHERE tp."packageId" = ${packageId}
        );
      `;

      // 4) NULL-out assigned agents first (preserve users)
      await tx.$executeRaw`
        UPDATE "Task"
        SET "assignedToId" = NULL
        WHERE "assignmentId" IN (
          SELECT a."id"
          FROM "Assignment" a
          JOIN "Template" tp ON tp."id" = a."templateId"
          WHERE tp."packageId" = ${packageId}
        );
      `;

      // 5) Delete tasks
      await tx.$executeRaw`
        DELETE FROM "Task"
        WHERE "assignmentId" IN (
          SELECT a."id"
          FROM "Assignment" a
          JOIN "Template" tp ON tp."id" = a."templateId"
          WHERE tp."packageId" = ${packageId}
        );
      `;

      // 6) Delete assignment site-asset settings
      await tx.$executeRaw`
        DELETE FROM "AssignmentSiteAssetSetting"
        WHERE "assignmentId" IN (
          SELECT a."id"
          FROM "Assignment" a
          JOIN "Template" tp ON tp."id" = a."templateId"
          WHERE tp."packageId" = ${packageId}
        );
      `;

      // 7) Delete assignments
      await tx.$executeRaw`
        DELETE FROM "Assignment"
        WHERE "templateId" IN (
          SELECT "id" FROM "Template" WHERE "packageId" = ${packageId}
        );
      `;

      // 8) Remove template-team memberships
      await tx.$executeRaw`
        DELETE FROM "TemplateTeamMember"
        WHERE "templateId" IN (
          SELECT "id" FROM "Template" WHERE "packageId" = ${packageId}
        );
      `;

      // 9) Delete template site assets
      await tx.$executeRaw`
        DELETE FROM "TemplateSiteAsset"
        WHERE "templateId" IN (
          SELECT "id" FROM "Template" WHERE "packageId" = ${packageId}
        );
      `;

      // 10) Delete templates
      await tx.$executeRaw`
        DELETE FROM "Template"
        WHERE "packageId" = ${packageId};
      `;

      // 11) Finally delete the package
      await tx.$executeRaw`
        DELETE FROM "Package"
        WHERE "id" = ${packageId};
      `;

      // Activity log (best-effort)
      try {
        await tx.activityLog.create({
          data: {
            id: crypto.randomUUID(),
            entityType: "Package",
            entityId: existing.id,
            userId: actorId,
            action: "delete",
            details: {
              name: existing.name ?? null,
              description: existing.description ?? null,
              cascade: true,
            },
          },
        });
      } catch {
        // ignore if no activityLog table
      }
    });

    console.log(`[Package Delete Cascade] DONE packageId=${packageId}`);

    return NextResponse.json({
      message: "Package deleted successfully (cascade).",
    });
  } catch (error: any) {
    if (error?.message === "NOT_FOUND") {
      return NextResponse.json(
        { error: "Package not found." },
        { status: 404 }
      );
    }
    console.error("[Package Delete Cascade] ERROR:", error);
    return NextResponse.json(
      { error: "Failed to delete package (cascade)." },
      { status: 500 }
    );
  }
}
