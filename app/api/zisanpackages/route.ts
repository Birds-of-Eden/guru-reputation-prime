// app/api/zisanpackages/route.ts

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ============================ GET Packages ============================
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeStats = searchParams.get("include") === "stats";

    // Simple payload (back-compat)
    if (!includeStats) {
      const packages = await prisma.package.findMany({
        select: {
          id: true,
          name: true,
          description: true,
          totalMonths: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { clients: true, templates: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(packages);
    }

    // Enriched payload (with per-package stats)
    const pkgs = await prisma.package.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        totalMonths: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { clients: true, templates: true } },
        templates: {
          select: {
            id: true,
            status: true,
            _count: {
              select: {
                sitesAssets: true,
                templateTeamMembers: true, // not relied on for teamMembers anymore
                assignments: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const packageIds = pkgs.map((p) => p.id);

    // Pull ALL TemplateTeamMember rows for templates under these packages,
    // selecting each row’s agentId and the template’s packageId
    const ttm = await prisma.templateTeamMember.findMany({
      where: {
        template: { packageId: { in: packageIds } },
      },
      select: {
        agentId: true,
        template: { select: { packageId: true } },
      },
    });

    // Build a map: packageId -> Set(agentId)  (UNIQUE agents per package)
    const teamUniqueByPkg = new Map<string, Set<string>>();
    for (const row of ttm) {
      const pkgId = row.template.packageId!;
      if (!teamUniqueByPkg.has(pkgId)) teamUniqueByPkg.set(pkgId, new Set());
      if (row.agentId) teamUniqueByPkg.get(pkgId)!.add(row.agentId);
    }

    // If you want TOTAL rows (not unique), you can alternatively do:
    // const teamTotalByPkg = new Map<string, number>();
    // for (const row of ttm) {
    //   const pkgId = row.template.packageId!;
    //   teamTotalByPkg.set(pkgId, (teamTotalByPkg.get(pkgId) ?? 0) + 1);
    // }

    // Count tasks per package
    const tasksCounts = await Promise.all(
      pkgs.map((p) =>
        prisma.task.count({
          where: { assignment: { template: { packageId: p.id } } },
        })
      )
    );

    const enriched = pkgs.map((p, i) => {
      const activeTemplates =
        p.templates?.filter((t) => t.status?.toLowerCase() === "active")
          .length || 0;

      const sitesAssets =
        p.templates?.reduce(
          (sum, t) => sum + (t._count?.sitesAssets || 0),
          0
        ) || 0;

      const assignments =
        p.templates?.reduce(
          (sum, t) => sum + (t._count?.assignments || 0),
          0
        ) || 0;

      // ✅ Team from TemplateTeamMember → Template → Package (UNIQUE agents)
      const teamMembers = teamUniqueByPkg.get(p.id)?.size ?? 0;
      // If you prefer TOTAL rows instead, swap to:
      // const teamMembers = teamTotalByPkg.get(p.id) ?? 0;

      return {
        id: p.id,
        name: p.name,
        description: p.description,
        totalMonths: p.totalMonths,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        stats: {
          clients: p._count?.clients || 0,
          templates: p._count?.templates || 0,
          activeTemplates,
          sitesAssets,
          teamMembers,
          assignments,
          tasks: tasksCounts[i] || 0,
        },
      };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch packages" },
      { status: 500 }
    );
  }
}

// ============================ CREATE Package ============================
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const headerActor = request.headers.get("x-actor-id");
    const actorId =
      (typeof body.actorId === "string" && body.actorId) ||
      (typeof headerActor === "string" && headerActor) ||
      null;

    const {
      name,
      description,
      type,
    } = body as {
      name?: string;
      description?: string | null;
      totalMonths?: number | string | null;
      type?: string;
    };
    let { totalMonths } = body as {
      totalMonths?: number | string | null;
    };

    // Basic validation
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Package name is required" },
        { status: 400 }
      );
    }

    // Coerce totalMonths to number if string; allow null/undefined
    if (
      totalMonths !== undefined &&
      totalMonths !== null &&
      totalMonths !== ""
    ) {
      const coerced = Number(totalMonths);
      if (
        !Number.isFinite(coerced) ||
        coerced <= 0 ||
        !Number.isInteger(coerced)
      ) {
        return NextResponse.json(
          { error: "totalMonths must be a positive integer" },
          { status: 400 }
        );
      }
      totalMonths = coerced;
    } else {
      totalMonths = null;
    }

    const created = await prisma.$transaction(async (tx) => {
      const pkg = await tx.package.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          totalMonths: totalMonths as number | null,
        },
      });

      // Minimal activity log (if you have a table/model for this)
      await tx.activityLog.create({
        data: {
          id: crypto.randomUUID(),
          entityType: "Package",
          entityId: pkg.id,
          userId: actorId,
          action: "create",
          details: {
            name: pkg.name,
            description: pkg.description ?? null,
            totalMonths: pkg.totalMonths ?? null,
          },
        },
      });

      return pkg;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    // Handle Prisma unique errors for `name` (if unique)
    if (error?.code === "P2002" || error?.meta?.target?.includes("name")) {
      return NextResponse.json(
        { error: "Package name must be unique" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create package" },
      { status: 500 }
    );
  }
}
