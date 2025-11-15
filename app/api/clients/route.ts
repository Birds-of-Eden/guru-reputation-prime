// app/api/clients/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Helper to normalize platform values
const normalizePlatform = (input: unknown): string => {
  const raw = String(input ?? "").trim();
  return raw || "OTHER";
};
// Helper: allowed statuses for article topic usage
const ARTICLE_TOPIC_STATUSES = new Set([
  "Used 1",
  "Used 2",
  "Used 3",
  "Used 4",
  "Used 5",
  "Used 6",
  "Used 7",
  "Used 8",
  "Used 9",
  "Used 10",
  "More then 10",
  "Not yet Used",
]);

type ArticleTopic = {
  topicname: string;
  status: string; // constrained at runtime via ARTICLE_TOPIC_STATUSES
  usedDate?: string | null; // ISO string or null
  usedCount?: number; // derived/validated number
};

// Normalize and validate articleTopics input from request body
const normalizeArticleTopics = (input: unknown): ArticleTopic[] => {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      const topicname = String((item as any)?.topicname ?? "").trim();
      if (!topicname) return null;

      const rawStatus = String((item as any)?.status ?? "").trim();
      const status = ARTICLE_TOPIC_STATUSES.has(rawStatus)
        ? rawStatus
        : "Not yet Used";

      // usedCount normalization
      let usedCount: number | undefined = undefined;
      const rawCount = (item as any)?.usedCount;
      if (
        rawCount !== undefined &&
        rawCount !== null &&
        !Number.isNaN(Number(rawCount))
      ) {
        usedCount = Math.max(0, Number(rawCount));
      } else {
        // derive from status if not explicitly provided
        const match = /^Used\s+(\d+)$/.exec(status);
        if (match) {
          usedCount = Number(match[1]);
        } else if (status === "More then 10") {
          usedCount = 11;
        } else if (status === "Not yet Used") {
          usedCount = 0;
        }
      }

      // usedDate normalization -> ISO string or null
      let usedDate: string | null | undefined = undefined;
      const rawDate = (item as any)?.usedDate;
      if (rawDate === null) {
        usedDate = null;
      } else if (rawDate !== undefined) {
        const d = new Date(rawDate);
        usedDate = isNaN(d.getTime()) ? null : d.toISOString();
      }

      return {
        topicname,
        status,
        usedDate: usedDate ?? null,
        usedCount: usedCount ?? 0,
      } as ArticleTopic;
    })
    .filter(Boolean) as ArticleTopic[];
};

// New type for article categories
type ArticleCategory = {
  category: string;
  titles: Array<{
    title: string;
    draftLink: string;
    draftStatus: "Approved" | "Pending" | "Revision";
    status?: string;
    usedCount?: number;
    usedDate?: string | null;
  }>;
};

// Normalize and validate articleCategories input from request body
const normalizeArticleCategories = (input: unknown): ArticleCategory[] => {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      const category = String((item as any)?.category ?? "").trim();
      if (!category) return null;

      const titles = Array.isArray((item as any)?.titles)
        ? (item as any).titles
            .map((t: any) => {
              const title = String(t?.title ?? "").trim();
              if (!title) return null;

              const draftLink = String(t?.draftLink ?? "").trim();
              const draftStatus = ["Approved", "Pending", "Revision"].includes(
                t?.draftStatus
              )
                ? t.draftStatus
                : "Pending";

              const rawStatus = String(t?.status ?? "").trim();
              const status = ARTICLE_TOPIC_STATUSES.has(rawStatus)
                ? rawStatus
                : "Not yet Used";

              // usedCount normalization
              let usedCount: number | undefined = undefined;
              const rawCount = t?.usedCount;
              if (
                rawCount !== undefined &&
                rawCount !== null &&
                !Number.isNaN(Number(rawCount))
              ) {
                usedCount = Math.max(0, Number(rawCount));
              } else {
                // derive from status if not explicitly provided
                const match = /^Used\s+(\d+)$/.exec(status);
                if (match) {
                  usedCount = Number(match[1]);
                } else if (status === "More then 10") {
                  usedCount = 11;
                } else if (status === "Not yet Used") {
                  usedCount = 0;
                }
              }

              // usedDate normalization -> ISO string or null
              let usedDate: string | null | undefined = undefined;
              const rawDate = t?.usedDate;
              if (rawDate === null) {
                usedDate = null;
              } else if (rawDate !== undefined) {
                const d = new Date(rawDate);
                usedDate = isNaN(d.getTime()) ? null : d.toISOString();
              }

              return { 
                title, 
                draftLink, 
                draftStatus,
                status,
                usedCount: usedCount ?? 0,
                usedDate: usedDate ?? null,
              };
            })
            .filter(Boolean)
        : [];

      if (titles.length === 0) return null;

      return { category, titles } as ArticleCategory;
    })
    .filter(Boolean) as ArticleCategory[];
};

// GET /api/clients - Get all clients (with clientUserId attached) or a single client by id
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const packageId = searchParams.get("packageId");
    const amId = searchParams.get("amId");

    if (id) {
      const client = await prisma.client.findUnique({
        where: { id },
        include: {
          accountManager: { select: { id: true, name: true, email: true } },
        },
      });
      if (!client) return NextResponse.json(null);
      const user = await prisma.user.findFirst({
        where: { clientId: id, role: { name: "client" } },
        select: { id: true },
      });
      const socialMedias = Array.isArray((client as any).socialMedia)
        ? ((client as any).socialMedia as any[])
        : [];
      return NextResponse.json({
        ...client,
        socialMedias,
        clientUserId: user?.id ?? null,
      });
    }

    const clients = await prisma.client.findMany({
      where: {
        packageId: packageId || undefined,
        amId: amId || undefined,
      },
      // Only select fields needed for the client list view
      select: {
        id: true,
        name: true,
        company: true,
        designation: true,
        email: true,
        phone: true,
        avatar: true,
        status: true,
        progress: true,
        packageId: true,
        amId: true,
        startDate: true,
        dueDate: true,
        createdAt: true,
        socialMedia: true,
        accountManager: { select: { id: true, name: true, email: true } },
        package: { select: { id: true, name: true } },
        tasks: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            dueDate: true,
            completedAt: true,
          },
        },
      },
      // Sort by recent first for better UX
      orderBy: { createdAt: 'desc' },
      // Limit to prevent overwhelming response (optional based on your needs)
      take: 1000,
    });

    if (clients.length === 0) {
      return NextResponse.json([]);
    }

    const clientIds = clients.map((c) => c.id);
    const clientUsers = await prisma.user.findMany({
      where: {
        clientId: { in: clientIds },
        role: { name: "client" },
      },
      select: { id: true, clientId: true },
    });

    const clientIdToUserId = new Map<string | number, string>();
    for (const u of clientUsers) {
      const key = u.clientId as unknown as string | number;
      if (!clientIdToUserId.has(key)) {
        clientIdToUserId.set(key, String(u.id));
      }
    }

    const result = clients.map((c) => ({
      ...c,
      socialMedias: Array.isArray((c as any).socialMedia)
        ? ((c as any).socialMedia as any[])
        : [],
      clientUserId: clientIdToUserId.get(c.id) ?? null,
    }));

    // Add cache headers for better performance (cache for 10 seconds, revalidate in background)
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
      },
    });
  } catch (error) {
    console.error("POST /api/clients error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST /api/clients - Create new client - activity log logic added by Faysal (29/09/2025)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      name,
      birthdate,
      company,
      gender,
      designation,
      location,

      // NEW fields
      email,
      phone,
      password,
      recoveryEmail,
      websites,
      companywebsite,
      companyaddress,
      biography,
      imageDrivelink,
      avatar,
      progress,
      status,
      packageId,
      startDate,
      dueDate,
      socialLinks = [],
      otherField = [],
      articleTopics,
      articleCategories,
      amId,
    } = body;

    // Debug: Log received article data
    console.log("POST /api/clients - Received articleTopics:", articleTopics);
    console.log("POST /api/clients - Received articleCategories:", articleCategories);

    // (Optional) enforce AM role server-side
    if (amId) {
      const am = await prisma.user.findUnique({
        where: { id: amId },
        include: { role: true },
      });
      if (!am || am.role?.name !== "am") {
        return NextResponse.json(
          { error: "amId is not an Account Manager" },
          { status: 400 }
        );
      }
    }

    // Basic validation
    const trimmedName = String(name ?? "").trim();
    if (!trimmedName) {
      return NextResponse.json(
        { error: "Client name is required" },
        { status: 400 }
      );
    }

    // Validate optional foreign keys
    if (packageId) {
      const pkg = await prisma.package.findUnique({ where: { id: packageId } });
      if (!pkg) {
        return NextResponse.json(
          { error: "Invalid packageId" },
          { status: 400 }
        );
      }
    }

    // Coerce progress to number when provided
    const progressNumber =
      progress === undefined || progress === null || progress === ""
        ? undefined
        : Number(progress);
    if (progressNumber !== undefined && Number.isNaN(progressNumber)) {
      return NextResponse.json(
        { error: "progress must be a number" },
        { status: 400 }
      );
    }

    // Parse dates only if valid
    const parseDate = (v: any) => {
      if (!v) return undefined;
      const d = new Date(v);
      return isNaN(d.getTime()) ? undefined : d;
    };

    // Create client
    let client;
    try {
      client = await prisma.client.create({
        data: {
          name: trimmedName,
          birthdate: parseDate(birthdate),
          company,
          gender,
          designation,
          location,

          email,
          phone,
          password,
          recoveryEmail,
          websites,
          companywebsite,
          companyaddress,
          biography,
          imageDrivelink,
          avatar,
          progress: progressNumber as any,
          status,
          packageId,
          startDate: parseDate(startDate) as any,
          dueDate: parseDate(dueDate) as any,
          otherField: Array.isArray(otherField) ? otherField : [],

          socialMedia: Array.isArray(socialLinks)
            ? socialLinks
                .filter((l: any) => l && (l.platform || l.url))
                .map((l: any) => ({
                  platform: normalizePlatform(l.platform),
                  url: l.url ?? null,
                  username: l.username ?? null,
                  email: l.email ?? null,
                  phone: l.phone ?? null,
                  password: l.password ?? null,
                  notes: l.notes ?? null,
                }))
            : [],

          // Use articleTopics field for both old structure and new categories structure
          // Check both articleCategories and articleTopics parameters
          articleTopics: articleCategories 
            ? normalizeArticleCategories(articleCategories)
            : articleTopics && Array.isArray(articleTopics) && articleTopics.length > 0
              ? (articleTopics[0] && 'category' in articleTopics[0] 
                  ? normalizeArticleCategories(articleTopics)  // New structure in articleTopics
                  : normalizeArticleTopics(articleTopics))     // Old structure in articleTopics
              : undefined,
          amId: amId || undefined,
        } as any,
        include: {
          accountManager: { select: { id: true, name: true, email: true } },
        },
      });

      // Debug: Log saved client data
      console.log("POST /api/clients - Client created with ID:", client.id);
      console.log("POST /api/clients - Saved articleTopics:", client.articleTopics);
    } catch (err: any) {
      console.error(
        "POST /api/clients prisma create error:",
        err?.code,
        err?.message,
        err?.meta
      );
      if (err?.code === "P2003") {
        return NextResponse.json(
          { error: "Foreign key constraint failed" },
          { status: 400 }
        );
      }
      if (err?.code === "P2002") {
        return NextResponse.json(
          { error: "Unique constraint violation" },
          { status: 409 }
        );
      }
      throw err;
    }

    // === Activity via /api/activity with cookies forwarded ===
    try {
      const origin =
        req.headers.get("origin") || (req as any).nextUrl?.origin || "";
      const cookie = req.headers.get("cookie") ?? "";

      const res = await fetch(`${origin}/api/activity`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // forward auth/session so getAuthUser() works
          Cookie: cookie,
        },
        body: JSON.stringify({
          entityType: "client",
          entityId: String(client.id),
          action: "onboarded", // or "created"
          details: {
            name: client.name,
            email: client.email ?? null,
            packageId: client.packageId ?? null,
            amId: client.amId ?? null,
            status: client.status ?? null,
          },
          // userId optional; /api/activity already tries getAuthUser()
          // userId: amId,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("Activity POST failed:", res.status, text);

        // Fallback: write directly so you never lose the log
        try {
          await prisma.activityLog.create({
            data: {
              id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
              entityType: "client",
              entityId: String(client.id),
              action: "onboarded",
              details: {
                name: client.name,
                email: client.email ?? null,
                packageId: client.packageId ?? null,
                amId: client.amId ?? null,
                status: client.status ?? null,
              } as any,
            },
          });
        } catch (e2) {
          console.error("Activity fallback failed:", e2);
        }
      }
    } catch (e) {
      console.error("Activity POST error:", e);
      // Fallback if network/origin resolution fails
      try {
        await prisma.activityLog.create({
          data: {
            id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            entityType: "client",
            entityId: String(client.id),
            action: "onboarded",
            details: {
              name: client.name,
              email: client.email ?? null,
              packageId: client.packageId ?? null,
              amId: client.amId ?? null,
              status: client.status ?? null,
            } as any,
          },
        });
      } catch (e2) {
        console.error("Activity fallback failed:", e2);
      }
    }

    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PUT /api/clients?id=CLIENT_ID - Update existing client (including otherField and socialMedias)
export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing client id" }, { status: 400 });
    }

    const body = await req.json();
    const {
      name,
      birthdate,
      company,
      designation,
      location,
      email,
      phone,
      password,
      recoveryEmail,
      websites,
      companywebsite,
      companyaddress,
      biography,
      imageDrivelink,
      avatar,
      progress,
      status,
      packageId,
      startDate,
      dueDate,
      socialLinks = [],
      otherField = [],
      amId,
      // NEW: article topics
      articleTopics,
      // NEW: allow categories structure too
      articleCategories,
    } = body;

    // Replace social medias with the provided set
    const updated = await prisma.client.update({
      where: { id },
      data: {
        name,
        birthdate: birthdate ? new Date(birthdate) : null,
        company,
        designation,
        location,
        email,
        phone,
        password,
        recoveryEmail,
        websites,
        companywebsite,
        companyaddress,
        biography,
        imageDrivelink,
        avatar,
        progress,
        status,
        packageId,
        startDate: startDate ? new Date(startDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        otherField: Array.isArray(otherField) ? otherField : [],
        // Accept both articleCategories and articleTopics (old/new structure)
        articleTopics:
          articleCategories !== undefined
            ? (normalizeArticleCategories as any)(articleCategories)
            : articleTopics !== undefined
            ? (Array.isArray(articleTopics) && articleTopics.length > 0 && (articleTopics as any)[0] && 'category' in (articleTopics as any)[0]
                ? (normalizeArticleCategories as any)(articleTopics)
                : normalizeArticleTopics(articleTopics))
            : undefined,
        amId: amId ?? null,
      },
      include: {
        accountManager: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE /api/clients?id=CLIENT_ID  (also accepts { id } in JSON body)
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id") ?? "";

    if (!id) {
      try {
        const body = await req.json();
        id = body?.id || "";
      } catch {
        /* ignore body parse errors */
      }
    }

    if (!id) {
      return NextResponse.json({ error: "Missing client id" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // 1) Find assignments & tasks for this client
      const assignments = await tx.assignment.findMany({
        where: { clientId: id },
        select: { id: true },
      });
      const assignmentIds = assignments.map((a) => a.id);

      const directTasks = await tx.task.findMany({
        where: { clientId: id },
        select: { id: true },
      });
      const assignmentTasks = assignmentIds.length
        ? await tx.task.findMany({
            where: { assignmentId: { in: assignmentIds } },
            select: { id: true },
          })
        : [];

      const allTaskIds = Array.from(
        new Set([...directTasks, ...assignmentTasks].map((t) => t.id))
      );

      // 2) Delete task children first
      if (allTaskIds.length) {
        await tx.comment.deleteMany({ where: { taskId: { in: allTaskIds } } });
        await tx.report.deleteMany({ where: { taskId: { in: allTaskIds } } });
        await tx.notification.deleteMany({
          where: { taskId: { in: allTaskIds } },
        });
      }

      // 3) Delete tasks
      if (allTaskIds.length) {
        await tx.task.deleteMany({ where: { id: { in: allTaskIds } } });
      }

      // 4) Delete assignment extras, then assignments
      if (assignmentIds.length) {
        await tx.assignmentSiteAssetSetting.deleteMany({
          where: { assignmentId: { in: assignmentIds } },
        });
        await tx.assignment.deleteMany({
          where: { id: { in: assignmentIds } },
        });
      }

      // 5) Other client-owned records
      await tx.clientTeamMember.deleteMany({ where: { clientId: id } });

      // 6) Finally delete the client
      await tx.client.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
