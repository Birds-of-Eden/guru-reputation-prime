// app/api/clients/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { TaskStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { getAuthUser } from "@/lib/getAuthUser";

// --- helpers ---
function coerceSocialMedia(input: any): any[] | undefined {
  if (input === undefined) return undefined;
  if (Array.isArray(input)) return input;
  return [];
}

async function computeClientProgress(clientId: string) {
  // সব টাস্ক নিয়ে groupBy করে কাউন্ট
  const grouped = await prisma.task.groupBy({
    by: ["status"],
    where: { clientId },
    _count: { _all: true },
  });

  // স্কিমার সব স্ট্যাটাস জিরো-ইনিশিয়ালাইজ
  const base: Record<TaskStatus, number> = {
    pending: 0,
    in_progress: 0,
    paused: 0,
    completed: 0,
    overdue: 0,
    cancelled: 0,
    reassigned: 0,
    qc_approved: 0,
    data_entered: 0,
  };

  for (const row of grouped) {
    base[row.status] = row._count._all;
  }

  const total =
    base.pending +
    base.in_progress +
    base.completed +
    base.overdue +
    base.cancelled +
    base.reassigned +
    base.qc_approved;

  const progress = total > 0 ? Math.round((base.completed / total) * 100) : 0;

  return {
    progress,
    taskCounts: {
      total,
      completed: base.completed,
      pending: base.pending,
      in_progress: base.in_progress,
      overdue: base.overdue,
      cancelled: base.cancelled,
      reassigned: base.reassigned,
      qc_approved: base.qc_approved,
    },
  };
}

async function recalcAndStoreClientProgress(clientId: string) {
  const { progress, taskCounts } = await computeClientProgress(clientId);
  // Use updateMany to avoid throwing P2025 if the client does not exist.
  const result = await prisma.client.updateMany({
    where: { id: clientId },
    data: { progress },
  });
  if (result.count === 0) {
    console.warn(
      `recalcAndStoreClientProgress: No client found to update for id=${clientId}`
    );
  }
  return { progress, taskCounts };
}

// Optional: amId server-side role guard
async function assertIsAMOrNull(amId: string | null | undefined) {
  if (!amId) return;
  const am = await prisma.user.findUnique({
    where: { id: amId },
    include: { role: true },
  });
  if (!am || am.role?.name !== "am") {
    throw new Error("amId is not an Account Manager (role 'am').");
  }
}

function buildClientSelect(compact: boolean): Prisma.ClientSelect {
  const base: Prisma.ClientSelect = {
    id: true,
    name: true,
    email: true,
    phone: true,
    avatar: true,
    company: true,
    designation: true,
    location: true,
    birthdate: true,
    gender: true,
    websites: true,
    companywebsite: true,
    companyaddress: true,
    biography: true,
    imageDrivelink: true,
    status: true,
    progress: true,
    startDate: true,
    dueDate: true,
    password: true,
    recoveryEmail: true,
    articleTopics: true,
    otherField: true,
    socialMedia: true,
    packageId: true,
    amId: true,
    createdAt: true,
    updatedAt: true,
    package: {
      select: {
        id: true,
        name: true,
        totalMonths: true,
      },
    },
    accountManager: {
      select: {
        id: true,
        name: true,
        email: true,
        role: {
          select: { id: true, name: true },
        },
      },
    },
  };

  if (!compact) {
    base.tasks = {
      select: {
        id: true,
        name: true,
        status: true,
        priority: true,
        dueDate: true,
        createdAt: true,
        completedAt: true,
        completionLink: true,
        taskCompletionJson: true,
        idealDurationMinutes: true,
        categoryId: true,
        templateSiteAssetId: true,
        assignedToId: true,
        category: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        templateSiteAsset: {
          select: {
            id: true,
            name: true,
            type: true,
            url: true,
          },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    };

    base.teamMembers = {
      select: {
        agent: {
          select: { id: true, name: true, email: true },
        },
        team: {
          select: { id: true, name: true },
        },
      },
    };
  }

  return base;
}

// --- GET ---
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const isDistributionView =
    searchParams.get("view")?.toLowerCase() === "distribution";

  try {
    const [client, fresh] = await Promise.all([
      prisma.client.findUnique({
        where: { id },
        select: buildClientSelect(isDistributionView),
      }),
      isDistributionView
        ? Promise.resolve(null)
        : recalcAndStoreClientProgress(id),
    ]);

    if (!client)
      return NextResponse.json(
        { message: "Client not found" },
        { status: 404 }
      );

    const socialMedias = Array.isArray((client as any).socialMedia)
      ? ((client as any).socialMedia as any[])
      : [];

    const response = {
      ...client,
      socialMedias,
      progress: fresh?.progress ?? client.progress ?? 0,
      taskCounts: fresh?.taskCounts ?? null,
    };

    // OPTIMIZATION (conditional payload + cache): keep CDN caching but shrink response when distribution view only needs summary.
    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        "CDN-Cache-Control": "public, s-maxage=60",
        "Vercel-CDN-Cache-Control": "public, s-maxage=60",
      },
    });
  } catch (error) {
    console.error(`Error fetching client ${id}:`, error);
    return NextResponse.json(
      { message: "Failed to fetch client" },
      { status: 500 }
    );
  }
}
// --- PUT ---
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await req.json();
    const {
      name,
      birthdate,
      gender,
      company,
      designation,
      location,
      websites,
      companywebsite,
      companyaddress,
      biography,
      imageDrivelink,
      avatar,
      // progress - ক্লায়েন্ট থেকে নেবো না; আমরা নিজেই রিক্যালকুলেট করবো
      status,
      packageId,
      startDate,
      dueDate,

      articleTopics,
      articleCategories,

      // ⬇️ নতুন ফিল্ডগুলো (contact/credentials + AM)
      email,
      phone,
      password,
      recoveryEmail,
      amId,
      // ⬇️ Arbitrary JSON key/value pairs
      otherField,
      socialMedia,
    } = body;

    // amId server-side validation (role must be 'am') — allow null to clear
    const amIdValue =
      typeof amId === "string" && amId.trim().length > 0 ? amId : null;
    await assertIsAMOrNull(amIdValue);

    // আপডেট (progress বাদ)
    const updated = await prisma.client.update({
      where: { id },
      data: {
        name,
        birthdate: birthdate ? new Date(birthdate) : undefined,
        gender,
        company,
        designation,
        location,

        // নতুন ফিল্ডগুলো সংরক্ষণ
        email,
        phone,
        // Persist articleTopics JSON if provided (supports both old and new structure)
        articleTopics: articleCategories
          ? JSON.parse(JSON.stringify(articleCategories))
          : articleTopics
          ? JSON.parse(JSON.stringify(articleTopics))
          : undefined,
        password,
        recoveryEmail,
        websites,
        companywebsite,
        companyaddress,
        biography,
        imageDrivelink,
        avatar,
        status,
        packageId,
        startDate: startDate ? new Date(startDate) : undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,

        // AM রিলেশন আপডেট
        amId: amIdValue, // null হলে unlink হবে

        // Persist arbitrary JSON if provided
        otherField: otherField ?? undefined,
        socialMedia:
          coerceSocialMedia(socialMedia) === undefined
            ? undefined
            : JSON.parse(JSON.stringify(coerceSocialMedia(socialMedia))),
      } as any,
      include: {
        package: true,
        accountManager: { include: { role: true } }, // AM দেখাতে
        teamMembers: {
          include: {
            agent: { include: { role: true } },
            team: true,
          },
        },
        tasks: {
          select: {
            id: true,
            name: true,
            status: true,
            priority: true,
            dueDate: true,
            createdAt: true,
            completedAt: true,
            completionLink: true,
            taskCompletionJson: true,
            idealDurationMinutes: true,
            categoryId: true,
            templateSiteAssetId: true,
            assignedToId: true,
            assignedTo: {
              select: {
                id: true,
                name: true,
                email: true,
                role: { select: { id: true, name: true } },
              },
            },
            templateSiteAsset: true,
            category: true,
          },
        },
        assignments: {
          include: {
            template: {
              include: {
                sitesAssets: true,
                templateTeamMembers: {
                  include: {
                    agent: { include: { role: true } },
                    team: true,
                  },
                },
              },
            },
            siteAssetSettings: { include: { templateSiteAsset: true } },
            tasks: {
              select: {
                id: true,
                name: true,
                status: true,
                priority: true,
                dueDate: true,
                createdAt: true,
                completedAt: true,
                completionLink: true,
                taskCompletionJson: true,
                idealDurationMinutes: true,
                categoryId: true,
                templateSiteAssetId: true,
                assignedToId: true,
                assignedTo: { select: { id: true, name: true, email: true } },
                templateSiteAsset: true,
              },
            },
          },
        },
      },
    });

    // আপডেটের পর progress রিক্যালকুলেট করে DB-তে লিখে নিন
    const fresh = await recalcAndStoreClientProgress(id);

    return NextResponse.json({
      ...updated,
      progress: fresh.progress,
      taskCounts: fresh.taskCounts,
    });
  } catch (error) {
    console.error(`Error updating client ${id}:`, error);
    // AM invalid হলে 400 দেওয়া হোক
    const message =
      error instanceof Error ? error.message : "Failed to update client";
    const status = message.includes("Account Manager") ? 400 : 500;
    return NextResponse.json({ message }, { status });
  }
}

// ---------- helpers ----------
const makeId = () =>
  `task_${Date.now()}_${
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  }`;

const norm = (s: string | null | undefined) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const keyOf = (a: {
  name: string | null | undefined;
  type: string | null | undefined;
}) => `${norm(a.type)}::${norm(a.name)}`;

// --- helpers for naming & dedupe ---
function stripTaskSuffix(s: string) {
  return String(s)
    .replace(/\s*task\s*$/i, "")
    .trim();
}
function normalizeForDedupe(s: string) {
  return stripTaskSuffix(
    String(s)
      .replace(/\s*-\s*\d+$/i, "")
      .trim()
  )
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
// --- end helpers ---

/**
 * Asset-type -> Task Category mapping
 */
const CATEGORY_BY_ASSET_TYPE: Record<string, string> = {
  // creation categories
  social_site: "Social Asset Creation",
  web2_site: "Web 2.0 Asset Creation",
  other_asset: "Additional Asset Creation",
  image_optimization: "Image Optimization",

  // the 9 non-creation categories you showed
  graphics_design: "Graphics Design",
  content_studio: "Content Studio",
  content_writing: "Content Writing",
  backlinks: "Backlinks",
  completed_com: "Completed Communication",
  youtube_video_optimization: "YouTube Video Optimization",
  monitoring: "Monitoring",
  review_removal: "Review Removal",
  summary_report: "Summary Report",
  guest_posting: "Guest Posting",
};

async function ensureCategoryByName(name: string) {
  const found = await prisma.taskCategory.findFirst({
    where: { name },
    select: { id: true, name: true },
  });
  if (found) return found;
  try {
    return await prisma.taskCategory.create({
      data: { name },
      select: { id: true, name: true },
    });
  } catch {
    return await prisma.taskCategory.findFirst({
      where: { name },
      select: { id: true, name: true },
    });
  }
}

// ---------- POST ----------
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;

  try {
    const body = await req.json().catch(() => ({} as any));
    const action = body?.action;

    if (action !== "upgrade") {
      return NextResponse.json(
        {
          message:
            "Unsupported action. Use { action: 'upgrade', newPackageId, templateId?, createAssignments?, migrateCompleted?, createPostingTasks? }",
        },
        { status: 400 }
      );
    }

    const newPackageId = String(body?.newPackageId || "").trim();
    const selectedTemplateId: string | null =
      typeof body?.templateId === "string" && body?.templateId.trim()
        ? body.templateId.trim()
        : null;

    const createAssignments: boolean = body?.createAssignments ?? true;
    const migrateCompleted: boolean = body?.migrateCompleted ?? true;
    const createPostingTasks: boolean = body?.createPostingTasks ?? true;

    if (!newPackageId) {
      return NextResponse.json(
        { message: "newPackageId is required" },
        { status: 400 }
      );
    }

    // validate
    const clientRow = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, packageId: true },
    });
    if (!clientRow)
      return NextResponse.json(
        { message: "Client not found" },
        { status: 404 }
      );
    const oldPackageId = clientRow.packageId ?? null;

    const pkg = await prisma.package.findUnique({
      where: { id: newPackageId },
      select: { id: true, totalMonths: true },
    });
    if (!pkg)
      return NextResponse.json(
        { message: "Package not found" },
        { status: 404 }
      );

    // 1) update client → new package; optionally create assignments for all templates
    await prisma.$transaction(async (tx) => {
      await tx.client.update({
        where: { id: clientId },
        data: { packageId: newPackageId },
        select: { id: true },
      });

      if (createAssignments) {
        await tx.$executeRaw`
          INSERT INTO "Assignment" ("id","templateId","clientId","assignedAt","status")
          SELECT gen_random_uuid(), t."id", ${clientId}, now(), 'active'
          FROM "Template" t
          WHERE t."packageId" = ${newPackageId}
          AND NOT EXISTS (
            SELECT 1 FROM "Assignment" a
            WHERE a."templateId" = t."id" AND a."clientId" = ${clientId}
          );
        `;
      }

      try {
        const authUser = await getAuthUser(); // ✅ ইউজার বের করো

        await tx.activityLog.create({
          data: {
            id: crypto.randomUUID(),
            entityType: "Client",
            entityId: clientId,
            userId: authUser?.id || null, // ✅ ইউজারের id ব্যবহার করো
            action: "upgrade_package",
            details: {
              newPackageId,
              templateId: selectedTemplateId,
              createdAssignments: !!createAssignments,
            },
          },
        });
      } catch (err) {
        console.error("Activity log failed:", err);
      }
    });

    // Note: Template does not have default duration in schema. We'll use
    // TemplateSiteAsset.defaultIdealDurationMinutes during seeding instead.

    // 2) migrate completed/qc_approved/data_entered (keep original status & ALL original fields)
    if (migrateCompleted && oldPackageId) {
      try {
        const oldAssignments = await prisma.assignment.findMany({
          where: { clientId, template: { packageId: oldPackageId } },
          select: { id: true },
        });
        const oldAssignmentIds = oldAssignments.map((a) => a.id);

        if (oldAssignmentIds.length) {
          let targetAssignment = selectedTemplateId
            ? await prisma.assignment.findFirst({
                where: { clientId, templateId: selectedTemplateId },
                orderBy: { assignedAt: "desc" },
                select: { id: true },
              })
            : await prisma.assignment.findFirst({
                where: { clientId, template: { packageId: newPackageId } },
                orderBy: { assignedAt: "desc" },
                select: { id: true },
              });

          if (!targetAssignment && selectedTemplateId) {
            targetAssignment = await prisma.assignment.create({
              data: {
                id: `assignment_${Date.now()}_${Math.random()
                  .toString(36)
                  .slice(2, 9)}`,
                clientId,
                templateId: selectedTemplateId,
                status: "active",
                assignedAt: new Date(),
              },
              select: { id: true },
            });
          }

          if (targetAssignment) {
            // dedupe by exact name (migration keeps original names)
            const existingNames = await prisma.task.findMany({
              where: { assignmentId: targetAssignment.id },
              select: { name: true },
            });
            const nameSkip = new Set(existingNames.map((t) => t.name));

            const doneStatuses: TaskStatus[] = [
              "completed",
              "qc_approved",
              "data_entered",
            ];
            const oldDone = await prisma.task.findMany({
              where: {
                assignmentId: { in: oldAssignmentIds },
                status: { in: doneStatuses },
              },
              select: {
                // keep everything we can
                name: true,
                status: true,
                priority: true,
                idealDurationMinutes: true,
                dueDate: true,
                completionLink: true,
                email: true,
                password: true,
                username: true,
                notes: true,
                categoryId: true,
                templateSiteAssetId: true,
                // timestamps
                createdAt: true,
                completedAt: true,
                // optional assignee if you want to preserve who did it
                assignedToId: true, // <-- CHANGED (optional)
              },
              take: 5000,
            });

            if (oldDone.length) {
              const payloads: Prisma.TaskCreateArgs["data"][] = [];
              for (const src of oldDone) {
                if (!src.name || nameSkip.has(src.name)) continue;

                // Strictly keep original dates; do NOT coerce invalid dates   // <-- CHANGED
                const data: Prisma.TaskCreateArgs["data"] = {
                  id: makeId(),
                  name: src.name,
                  status: src.status,
                  priority: src.priority,
                  idealDurationMinutes: src.idealDurationMinutes ?? undefined,
                  dueDate: src.dueDate ?? undefined, // stay identical
                  completionLink: src.completionLink ?? undefined,
                  email: src.email ?? undefined,
                  password: src.password ?? undefined,
                  username: src.username ?? undefined,
                  notes: src.notes ?? undefined,
                  client: { connect: { id: clientId } },
                  assignment: { connect: { id: targetAssignment.id } },
                  ...(src.categoryId
                    ? { category: { connect: { id: src.categoryId } } }
                    : {}),
                  ...(src.templateSiteAssetId
                    ? {
                        templateSiteAsset: {
                          connect: { id: src.templateSiteAssetId },
                        },
                      }
                    : {}),
                  // Timestamps preserved                               // <-- CHANGED
                  createdAt: src.createdAt ?? undefined,
                  completedAt: src.completedAt ?? undefined,
                  // Optional: keep the assignee who completed it        // <-- CHANGED
                  ...(src.assignedToId
                    ? { assignedTo: { connect: { id: src.assignedToId } } }
                    : {}),
                };

                payloads.push(data);
              }

              if (payloads.length) {
                const chunk = 100;
                for (let i = 0; i < payloads.length; i += chunk) {
                  const slice = payloads.slice(i, i + chunk);
                  await prisma.$transaction(
                    slice.map((data) =>
                      prisma.task.create({ data, select: { id: true } })
                    )
                  );
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn("[Migration] Copy done tasks failed:", e);
      }
    }

    // 3) Seed base sources from new package assets into their proper categories
    //    (dedupe per category ACROSS THE ENTIRE CLIENT) and create posting cycles
    let createdPostingNewOnly = 0;
    let createdPostingCommon = 0;

    if (createPostingTasks) {
      try {
        const [oldAssets, newScopedAssets] = await Promise.all([
          oldPackageId
            ? prisma.templateSiteAsset.findMany({
                where: { template: { packageId: oldPackageId } },
                select: { id: true, name: true, type: true },
              })
            : Promise.resolve(
                [] as { id: number; name: string | null; type: string | null }[]
              ),
          prisma.templateSiteAsset.findMany({
            where: {
              template: selectedTemplateId
                ? { id: selectedTemplateId }
                : { packageId: newPackageId },
            },
            select: {
              id: true,
              name: true,
              type: true,
              templateId: true,
              defaultIdealDurationMinutes: true, // use per-asset default duration
            },
          }),
        ]);

        const oldKeys = new Set(oldAssets.map(keyOf));
        const newOnlyAssetIds = newScopedAssets
          .filter((a) => !oldKeys.has(keyOf(a)))
          .map((a) => a.id);
        const commonAssetIds = newScopedAssets
          .filter((a) => oldKeys.has(keyOf(a)))
          .map((a) => a.id);

        // target assignment
        let targetAssignment = selectedTemplateId
          ? await prisma.assignment.findFirst({
              where: { clientId, templateId: selectedTemplateId },
              orderBy: { assignedAt: "desc" },
              select: { id: true },
            })
          : await prisma.assignment.findFirst({
              where: { clientId, template: { packageId: newPackageId } },
              orderBy: { assignedAt: "desc" },
              select: { id: true },
            });

        if (!targetAssignment && selectedTemplateId) {
          await prisma.$executeRaw`
            INSERT INTO "Assignment" ("id","templateId","clientId","assignedAt","status")
            VALUES (gen_random_uuid(), ${selectedTemplateId}, ${clientId}, now(), 'active');
          `;
          targetAssignment = await prisma.assignment.findFirst({
            where: { clientId, templateId: selectedTemplateId },
            orderBy: { assignedAt: "desc" },
            select: { id: true },
          });
        }

        // ======= SEEDING with category-aware, client-wide dedupe =======
        if (targetAssignment) {
          const toCheckIds = [...newOnlyAssetIds, ...commonAssetIds];
          if (toCheckIds.length) {
            const metaById = new Map(newScopedAssets.map((a) => [a.id, a]));

            // pull ALL existing tasks for this client (spans old/new assignments)
            const existingInClient = await prisma.task.findMany({
              where: { clientId },
              select: {
                name: true,
                templateSiteAsset: {
                  select: { id: true, name: true, type: true },
                },
                category: { select: { name: true } },
              },
            });

            type CatSets = {
              nameBases: Set<string>;
              typeBaseKeys: Set<string>;
              assetBaseKeys: Set<string>;
            };
            const dedupeByCategory = new Map<string, CatSets>();

            function ensureCatSets(cat: string): CatSets {
              let v = dedupeByCategory.get(cat);
              if (!v) {
                v = {
                  nameBases: new Set<string>(),
                  typeBaseKeys: new Set<string>(),
                  assetBaseKeys: new Set<string>(),
                };
                dedupeByCategory.set(cat, v);
              }
              return v;
            }

            for (const t of existingInClient) {
              const catName = t.category?.name || "";
              if (!catName) continue;
              const sets = ensureCatSets(catName);

              const base = normalizeForDedupe(t.name || "");
              sets.nameBases.add(base);

              const typ = norm(t.templateSiteAsset?.type || "other_asset");
              sets.typeBaseKeys.add(`${typ}::${base}`);

              const assetId = t.templateSiteAsset?.id;
              if (typeof assetId === "number") {
                sets.assetBaseKeys.add(`asset_${assetId}::${base}`);
              }
            }

            const seededAssetIds = new Set<number>(
              existingInClient
                .map((t) => t.templateSiteAsset?.id)
                .filter((n): n is number => typeof n === "number")
                .filter((id) => (toCheckIds as number[]).includes(id))
            );

            const needSeeds: number[] = [];

            for (const assetId of toCheckIds) {
              const meta = metaById.get(assetId);
              const rawName = meta?.name || `Asset ${assetId}`;
              const rawType = norm(meta?.type || "");

              const catName = CATEGORY_BY_ASSET_TYPE[rawType];
              if (!catName) continue;

              const finalName = `${stripTaskSuffix(rawName)} Task`;
              const finalBase = normalizeForDedupe(finalName);

              const catSets = ensureCatSets(catName);

              const typeBaseKey = `${rawType}::${finalBase}`;
              const assetBaseKey = `asset_${assetId}::${finalBase}`;

              const isDup =
                seededAssetIds.has(assetId) ||
                catSets.nameBases.has(finalBase) ||
                catSets.typeBaseKeys.has(typeBaseKey) ||
                catSets.assetBaseKeys.has(assetBaseKey);

              if (!isDup) {
                needSeeds.push(assetId);
                catSets.nameBases.add(finalBase);
                catSets.typeBaseKeys.add(typeBaseKey);
                catSets.assetBaseKeys.add(assetBaseKey);
              }
            }

            if (needSeeds.length) {
              const catIdByName = new Map<string, string>();
              const categoriesNeeded = new Set<string>();
              for (const id of needSeeds) {
                const meta = metaById.get(id);
                const rawType = norm(meta?.type || "");
                const catName = CATEGORY_BY_ASSET_TYPE[rawType];
                if (catName) categoriesNeeded.add(catName);
              }
              for (const nm of Array.from(categoriesNeeded)) {
                const cat = await ensureCategoryByName(nm);
                if (cat) catIdByName.set(nm, cat.id);
              }

              await prisma.$transaction(
                needSeeds.map((assetId) => {
                  const meta = metaById.get(assetId)!;
                  const raw = meta?.name || `Asset ${assetId}`;
                  const rawType = norm(meta?.type || "");
                  const catName = CATEGORY_BY_ASSET_TYPE[rawType];
                  if (!catName) return prisma.$queryRaw`SELECT 1`;
                  const catId = catIdByName.get(catName)!;
                  const finalName = `${stripTaskSuffix(raw)} Task`;

                  // NEW task rules: dueDate = now, idealDuration from asset default
                  const idealDurationMinutes =
                    (meta as any).defaultIdealDurationMinutes ?? 60;

                  return prisma.task.create({
                    data: {
                      id: makeId(),
                      name: finalName,
                      status: "pending",
                      priority: "medium",
                      dueDate: new Date(), // <-- CHANGED
                      idealDurationMinutes, // <-- CHANGED
                      assignment: { connect: { id: targetAssignment!.id } },
                      client: { connect: { id: clientId } },
                      templateSiteAsset: { connect: { id: assetId } },
                      category: { connect: { id: catId } },
                    },
                    select: { id: true },
                  });
                })
              );
            }
          }
        }
        // ======= END SEEDING =======

        // run posting creation twice (both create **pending** tasks)
        const baseURL =
          process.env.NEXT_PUBLIC_APP_URL ??
          process.env.APP_URL ??
          `http://${req.headers.get("host")}`;

        async function runCreatePosting(includeAssetIds: number[]) {
          if (!includeAssetIds.length) return 0;
          const resp = await fetch(
            `${baseURL}/api/tasks/migration-posting-tasks`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                clientId,
                templateId: selectedTemplateId ?? undefined,
                includeAssetIds,
                // TIP: ensure that API also sets dueDate=now and uses template default duration  // <-- NOTE
              }),
            }
          );
          const j = await resp.json().catch(() => ({}));
          if (!resp.ok) {
            console.warn("[migration-posting-tasks] failed:", j?.message);
            return 0;
          }
          return Number(j?.created ?? 0);
        }

        createdPostingNewOnly = await runCreatePosting(newOnlyAssetIds);
        createdPostingCommon = await runCreatePosting(commonAssetIds);
      } catch (e) {
        console.warn("[migration-posting-tasks] flow error:", e);
      }
    }

    const createdPosting =
      (createdPostingNewOnly || 0) + (createdPostingCommon || 0);

    // 4) progress recompute
    const freshProgress = await (async () => {
      try {
        const grouped = await prisma.task.groupBy({
          by: ["status"],
          where: { clientId },
          _count: { _all: true },
        });

        const baseCounts: Record<TaskStatus, number> = {
          pending: 0,
          in_progress: 0,
          completed: 0,
          overdue: 0,
          cancelled: 0,
          reassigned: 0,
          qc_approved: 0,
          paused: 0,
          data_entered: 0,
        };
        for (const row of grouped) baseCounts[row.status] = row._count._all;

        const total =
          baseCounts.pending +
          baseCounts.in_progress +
          baseCounts.completed +
          baseCounts.overdue +
          baseCounts.cancelled +
          baseCounts.reassigned +
          baseCounts.qc_approved;

        const progress =
          total > 0 ? Math.round((baseCounts.completed / total) * 100) : 0;

        await prisma.client.update({
          where: { id: clientId },
          data: { progress },
          select: { id: true },
        });

        return {
          progress,
          taskCounts: {
            total,
            completed: baseCounts.completed,
            pending: baseCounts.pending,
            in_progress: baseCounts.in_progress,
            overdue: baseCounts.overdue,
            cancelled: baseCounts.cancelled,
            reassigned: baseCounts.reassigned,
            qc_approved: baseCounts.qc_approved,
          },
        };
      } catch {
        return { progress: 0, taskCounts: null as any };
      }
    })();

    // 5) return fresh snapshot
    const upgraded = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        package: true,
        accountManager: { include: { role: true } },
        teamMembers: {
          include: {
            agent: { include: { role: true } },
            team: true,
          },
        },
        tasks: {
          select: {
            id: true,
            name: true,
            status: true,
            priority: true,
            dueDate: true,
            createdAt: true,
            completedAt: true,
            completionLink: true,
            taskCompletionJson: true,
            idealDurationMinutes: true,
            categoryId: true,
            templateSiteAssetId: true,
            assignedToId: true,
            assignedTo: {
              select: {
                id: true,
                name: true,
                email: true,
                role: { select: { id: true, name: true } },
              },
            },
            templateSiteAsset: true,
            category: true,
          },
        },
        assignments: {
          include: {
            template: {
              include: {
                sitesAssets: true,
                templateTeamMembers: {
                  include: {
                    agent: { include: { role: true } },
                    team: true,
                  },
                },
              },
            },
            siteAssetSettings: { include: { templateSiteAsset: true } },
            tasks: {
              select: {
                id: true,
                name: true,
                status: true,
                priority: true,
                dueDate: true,
                createdAt: true,
                completedAt: true,
                completionLink: true,
                taskCompletionJson: true,
                idealDurationMinutes: true,
                categoryId: true,
                templateSiteAssetId: true,
                assignedToId: true,
                assignedTo: { select: { id: true, name: true, email: true } },
                templateSiteAsset: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      message: "Client upgraded successfully",
      createdPostingNewOnly,
      createdPostingCommon,
      createdPosting,
      client: {
        ...upgraded,
        progress: freshProgress.progress,
        taskCounts: freshProgress.taskCounts,
      },
    });
  } catch (error) {
    console.error(`[Client Upgrade] clientId=${clientId} failed:`, error);
    return NextResponse.json(
      { message: "Failed to upgrade client" },
      { status: 500 }
    );
  }
}
