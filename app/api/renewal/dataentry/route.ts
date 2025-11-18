// app/api/renewal/dataentry/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import type { TaskPriority, TaskStatus, SiteAssetType } from "@prisma/client";
import prisma from "@/lib/prisma";

// ---- constants
const ALLOWED_ASSET_TYPES: SiteAssetType[] = [
  "social_site",
  "web2_site",
  "other_asset",
  "content_writing",
  "backlinks",
  "review_removal",
  "summary_report",
  "guest_posting",
];
const CAT_SOCIAL_ACTIVITY = "Social Activity";
const CAT_BLOG_POSTING = "Blog Posting";
const CAT_SOCIAL_COMMUNICATION = "Social Communication";
const CAT_CONTENT_WRITING = "Content Writing";
const CAT_GUEST_POSTING = "Guest Posting";
const CAT_BACKLINKS = "Backlinks";
const CAT_REVIEW_REMOVAL = "Review Removal";
const CAT_SUMMARY_REPORT = "Summary Report";

const WEB2_FIXED_PLATFORMS = ["medium", "tumblr", "wordpress"] as const;
const PLATFORM_META: Record<
  "medium" | "tumblr" | "wordpress",
  { label: string; url: string }
> = {
  medium: { label: "Medium", url: "https://medium.com/" },
  tumblr: { label: "Tumblr", url: "https://www.tumblr.com/" },
  wordpress: { label: "Wordpress", url: "https://wordpress.com/" },
};

// ---- helpers
const makeId = () =>
  `task_${Date.now()}_${
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  }`;

function normalizeTaskPriority(v: unknown): TaskPriority {
  switch (String(v ?? "").toLowerCase()) {
    case "low":
      return "low";
    case "medium":
      return "medium";
    case "high":
      return "high";
    case "urgent":
      return "urgent";
    default:
      return "medium";
  }
}

// ================== WORKING-DAY HELPERS ==================
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function dateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(startDate: Date, days: number): Date {
  const copy = new Date(startDate);
  copy.setDate(copy.getDate() + days);
  return dateOnly(copy);
}

function addWorkingDays(startDate: Date, workingDays: number): Date {
  const result = dateOnly(startDate);
  let daysToAdd = workingDays;
  while (daysToAdd > 0) {
    result.setDate(result.getDate() + 1);
    if (!isWeekend(result)) {
      daysToAdd--;
    }
  }
  return dateOnly(result);
}

function monthsBetweenInclusive(d1: Date, d2: Date): number {
  const a = new Date(d1.getFullYear(), d1.getMonth(), 1);
  const b = new Date(d2.getFullYear(), d2.getMonth(), 1);
  const diff =
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  return Math.max(diff + 1, 0);
}

function toLocalMiddayISOString(d: Date): string {
  const local = new Date(d);
  local.setHours(12, 0, 0, 0);
  return local.toISOString();
}

function resolveCategoryFromType(assetType?: SiteAssetType | null): string {
  switch (assetType) {
    case "web2_site":
      return CAT_BLOG_POSTING;
    case "social_site":
      return CAT_SOCIAL_ACTIVITY;
    case "content_writing":
      return CAT_CONTENT_WRITING;
    case "guest_posting":
      return CAT_GUEST_POSTING;
    case "backlinks":
      return CAT_BACKLINKS;
    case "review_removal":
      return CAT_REVIEW_REMOVAL;
    case "summary_report":
      return CAT_SUMMARY_REPORT;
    case "other_asset":
    default:
      return CAT_SOCIAL_ACTIVITY;
  }
}
function baseNameOf(name: string): string {
  return String(name)
    .replace(/\s*-\s*\d+$/i, "")
    .trim();
}
function normalize(str: string) {
  return String(str).toLowerCase().replace(/\s+/g, " ").trim();
}
function matchPlatformFromWeb2Name(
  name: string
): "medium" | "tumblr" | "wordpress" | null {
  const n = normalize(name);
  if (/\bmedium\b/.test(n)) return "medium";
  if (/\btumblr\b/.test(n)) return "tumblr";
  if (/\bwordpress\b/.test(n) || /\bword\s*press\b/.test(n)) return "wordpress";
  return null;
}
function collectWeb2PlatformSources(
  srcTasks: {
    name: string;
    username: string | null;
    email: string | null;
    password: string | null;
    completionLink: string | null;
    templateSiteAsset?: { type: SiteAssetType | null } | null;
    idealDurationMinutes?: number | null;
  }[]
) {
  const map = new Map<
    "medium" | "tumblr" | "wordpress",
    {
      username: string;
      email: string;
      password: string;
      url: string;
      label: string;
      idealDurationMinutes?: number | null;
    }
  >();
  for (const t of srcTasks) {
    if (t.templateSiteAsset?.type !== "web2_site") continue;
    const p = matchPlatformFromWeb2Name(t.name);
    if (!p) continue;
    const username = t.username ?? "";
    const email = t.email ?? "";
    const password = t.password ?? "";
    const url = t.completionLink ?? "";
    const idealDurationMinutes = t.idealDurationMinutes ?? null;
    if (!username || !email || !password || !url) continue;
    if (!map.has(p)) {
      map.set(p, {
        username,
        email,
        password,
        url,
        label: PLATFORM_META[p].label,
        idealDurationMinutes,
      });
    }
  }
  return map;
}

function safeErr(err: unknown) {
  const anyErr = err as any;
  return {
    name: anyErr?.name ?? null,
    code: anyErr?.code ?? null,
    message: anyErr?.message ?? String(anyErr),
    meta: anyErr?.meta ?? null,
  };
}
function fail(stage: string, err: unknown, http = 500) {
  const e = safeErr(err);
  console.error(`[renewal/dataentry] ${stage} ERROR:`, err);
  return NextResponse.json(
    { message: "Internal Server Error", stage, error: e },
    { status: http }
  );
}

// ---- last-agent (inline version of /api/last-agent-for-client)
async function findLastAgentForClient(clientId: string) {
  const preferredStatuses = [
    "completed",
    "qc_approved",
    "data_entered",
  ] as const;

  // try preferred statuses
  let last = await prisma.task.findFirst({
    where: {
      clientId,
      assignedToId: { not: null },
      status: { in: preferredStatuses as any },
    },
    orderBy: [{ completedAt: "desc" }, { updatedAt: "desc" }],
    select: { assignedTo: { select: { id: true, name: true, email: true } } },
  });

  if (last?.assignedTo) return last.assignedTo;

  // fallback any assigned
  last = await prisma.task.findFirst({
    where: { clientId, assignedToId: { not: null } },
    orderBy: [{ updatedAt: "desc" }],
    select: { assignedTo: { select: { id: true, name: true, email: true } } },
  });
  if (last?.assignedTo) return last.assignedTo;

  // team member by completedTasks
  const ctm = await prisma.clientTeamMember.findFirst({
    where: { clientId },
    orderBy: [{ completedTasks: "desc" }, { assignedDate: "desc" }],
    select: { agent: { select: { id: true, name: true, email: true } } },
  });
  if (ctm?.agent) return ctm.agent;

  // account manager
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      accountManager: { select: { id: true, name: true, email: true } },
    },
  });
  return client?.accountManager ?? null;
}

// ---- POST
// Body: { clientId, templateId?, renewalDate: ISO, assignToUserId?: string, onlyType?, includeAssetIds?, excludeAssetIds?, priority? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const clientId: string | undefined = body?.clientId;
    const templateIdRaw: string | undefined = body?.templateId;
    const renewalDateISO: string | undefined = body?.renewalDate;
    const assignToUserId: string | undefined = body?.assignToUserId;
    const onlyType: string | undefined = body?.onlyType;

    const includeAssetIds = Array.isArray(body?.includeAssetIds)
      ? body?.includeAssetIds
          .map((n: any) => Number(n))
          .filter((n: number) => Number.isFinite(n))
      : undefined;
    const excludeAssetIds = Array.isArray(body?.excludeAssetIds)
      ? body?.excludeAssetIds
          .map((n: any) => Number(n))
          .filter((n: number) => Number.isFinite(n))
      : undefined;

    if (!clientId)
      return NextResponse.json(
        { message: "clientId is required" },
        { status: 400 }
      );
    if (!renewalDateISO)
      return NextResponse.json(
        { message: "renewalDate is required (ISO string)" },
        { status: 400 }
      );

    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (e) {
      return fail("POST.db-preflight", e);
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, package: { select: { totalMonths: true } } },
    });
    if (!client)
      return NextResponse.json(
        { message: "Client not found" },
        { status: 404 }
      );

    const monthsRaw = Number(client.package?.totalMonths ?? 1);
    const months =
      Number.isFinite(monthsRaw) && monthsRaw > 0
        ? Math.min(Math.floor(monthsRaw), 120)
        : 1;

    const renewalDateRaw = new Date(renewalDateISO);
    if (Number.isNaN(renewalDateRaw.getTime()))
      return NextResponse.json(
        { message: "renewalDate is invalid" },
        { status: 400 }
      );
    // Normalize to date-only at UTC midnight to avoid timezone drift
    const renewalDate = new Date(
      Date.UTC(
        renewalDateRaw.getUTCFullYear(),
        renewalDateRaw.getUTCMonth(),
        renewalDateRaw.getUTCDate()
      )
    );

    const dueDate = new Date(renewalDate);
    dueDate.setMonth(dueDate.getMonth() + months);

    await prisma.client.update({
      where: { id: clientId },
      data: { renewalDate, dueDate, renewalCount: { increment: 1 } },
      select: { id: true },
    });

    const templateId = templateIdRaw === "none" ? null : templateIdRaw;
    const assignment = await prisma.assignment.findFirst({
      where: {
        clientId,
        ...(templateId !== undefined
          ? { templateId: templateId ?? undefined }
          : {}),
      },
      orderBy: { assignedAt: "desc" },
      select: { id: true },
    });
    if (!assignment) {
      return NextResponse.json(
        {
          message:
            "No existing assignment found for this client. Please create one first.",
        },
        { status: 404 }
      );
    }

    const sourceTasks = await prisma.task.findMany({
      where: {
        assignmentId: assignment.id,
        status: "qc_approved",
        templateSiteAsset: {
          is: {
            ...(onlyType
              ? { type: onlyType as any }
              : { type: { in: ALLOWED_ASSET_TYPES } }),
            ...(includeAssetIds && includeAssetIds.length
              ? { id: { in: includeAssetIds as any } }
              : {}),
            ...(excludeAssetIds && excludeAssetIds.length
              ? { id: { notIn: excludeAssetIds as any } }
              : {}),
          },
        },
      },
      select: {
        id: true,
        name: true,
        status: true,
        priority: true,
        idealDurationMinutes: true,
        completionLink: true,
        email: true,
        password: true,
        username: true,
        notes: true,
        createdAt: true,
        templateSiteAsset: {
          select: {
            id: true,
            type: true,
            name: true,
            defaultPostingFrequency: true,
          },
        },
      },
    });

    if (!sourceTasks.length) {
      return NextResponse.json(
        {
          message: "No qc_approved source tasks found to copy.",
          created: 0,
          tasks: [],
        },
        { status: 200 }
      );
    }

    const todayOnly = dateOnly(new Date());
    const cutoff = todayOnly <= dueDate ? todayOnly : dueDate;

    const web2PlatformCreds = collectWeb2PlatformSources(sourceTasks as any);

    // ensure categories
    const ensureCategory = async (name: string) => {
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
        const again = await prisma.taskCategory.findFirst({
          where: { name },
          select: { id: true, name: true },
        });
        if (again) return again;
        throw new Error(`Failed to ensure category: ${name}`);
      }
    };

    const ALL_CATEGORY_NAMES = [
      CAT_SOCIAL_ACTIVITY,
      CAT_BLOG_POSTING,
      CAT_SOCIAL_COMMUNICATION,
      CAT_CONTENT_WRITING,
      CAT_GUEST_POSTING,
      CAT_BACKLINKS,
      CAT_REVIEW_REMOVAL,
      CAT_SUMMARY_REPORT,
    ];
    const ensured = await Promise.all(
      ALL_CATEGORY_NAMES.map((n) => ensureCategory(n))
    );
    const categoryIdByName = new Map<string, string>(
      ensured.map((c) => [c.name, c.id] as const)
    );

    const CUSTOM_SCHEDULE_OFFSETS: Record<string, number[]> = {
      [CAT_CONTENT_WRITING]: [30, 60, 90],
      [CAT_BACKLINKS]: [30, 60],
      [CAT_REVIEW_REMOVAL]: [30, 60, 90],
      [CAT_SUMMARY_REPORT]: [30, 60, 90],
      [CAT_GUEST_POSTING]: [30, 60, 90],
    };

    // Cadence dates generator: first = +1WD, then +7WD cycles, starting from last task or renewalDate
    function* cadenceDates(
      from: Date,
      end: Date,
      lastTaskDueDate: Date | null
    ) {
      let cur: Date;

      if (lastTaskDueDate && lastTaskDueDate >= from) {
        // Continue cycle from last task
        cur = addWorkingDays(lastTaskDueDate, 7); // changed to 7 WD
      } else {
        // First task after renewal
        cur = addWorkingDays(from, 1); // changed to 1 WD
      }

      if (cur > end) return;
      yield cur;

      while (true) {
        cur = addWorkingDays(cur, 7); // cycle every 7 WD after the first
        if (cur > end) break;
        yield cur;
      }
    }

    type FutureItem = {
      src: (typeof sourceTasks)[number];
      catName: string;
      base: string;
      name: string;
      dueDate: Date;
      seqIndex: number;
    };

    const future: FutureItem[] = [];

    for (const src of sourceTasks) {
      const catName = resolveCategoryFromType(src.templateSiteAsset?.type);
      const base = baseNameOf(src.name);

      // Get existing tasks for this source to determine starting sequence index and last due date
      const existingTasksForSource = await prisma.task.findMany({
        where: {
          assignmentId: assignment.id,
          name: { startsWith: base + " -" },
          category: { name: { in: ALL_CATEGORY_NAMES } },
        },
        select: { name: true, dueDate: true },
        orderBy: { dueDate: "desc" },
      });

      // Find the last task's due date for this source
      const lastTaskDueDate =
        existingTasksForSource.length > 0 && existingTasksForSource[0].dueDate
          ? new Date(existingTasksForSource[0].dueDate)
          : null;

      const customOffsets = CUSTOM_SCHEDULE_OFFSETS[catName];
      if (customOffsets) {
        const customDates = customOffsets
          .map((offset) => addDays(renewalDate, offset))
          .filter(
            (date) =>
              date.getTime() <= cutoff.getTime() &&
              date.getTime() <= dueDate.getTime()
          );

        customDates.forEach((dueDateForTask, idx) => {
          const seqIndex = existingTasksForSource.length + idx + 1;
          future.push({
            src,
            catName,
            base,
            name: `${base} -${seqIndex}`,
            dueDate: dueDateForTask,
            seqIndex,
          });
        });
        continue;
      }

      const freqPerMonthRaw =
        src.templateSiteAsset?.defaultPostingFrequency ?? 1;
      const freqPerMonth = Math.max(1, Number(freqPerMonthRaw) || 1);

      // Total months from renewalDate to dueDate
      const totalMonths = monthsBetweenInclusive(renewalDate, dueDate);
      const totalNeeded = totalMonths * freqPerMonth;

      // Per-month cap implementation
      const perMonthCount = new Map<string, number>(); // "YYYY-MM" -> count for THIS src
      let accepted = 0;

      const startingSeqIndex = existingTasksForSource.length + 1;

      for (const d of cadenceDates(renewalDate, dueDate, lastTaskDueDate)) {
        const dOnly = dateOnly(d);
        if (dOnly.getTime() > cutoff.getTime()) break; // Stop at cutoff (today or dueDate)

        const key = `${dOnly.getFullYear()}-${String(
          dOnly.getMonth() + 1
        ).padStart(2, "0")}`;
        const used = perMonthCount.get(key) ?? 0;

        if (used < freqPerMonth) {
          perMonthCount.set(key, used + 1);
          accepted++;

          const seqIndex = startingSeqIndex + accepted - 1;
          future.push({
            src,
            catName,
            base,
            name: `${base} -${seqIndex}`,
            dueDate: dOnly,
            seqIndex,
          });

          if (accepted >= totalNeeded) break;
        }
      }
    }

    if (future.length === 0) {
      return NextResponse.json(
        {
          message:
            "No occurrences fall within the requested window (renewalDate+7WD to cutoff).",
          created: 0,
          cutoff,
          scheduleCount: 0,
          renewalDate,
          dueDate,
        },
        { status: 200 }
      );
    }

    // Skip duplicates
    const namesToCheck = Array.from(new Set(future.map((f) => f.name)));
    const existingTasks = namesToCheck.length
      ? await prisma.task.findMany({
          where: {
            assignmentId: assignment.id,
            name: { in: namesToCheck },
            category: { name: { in: ALL_CATEGORY_NAMES } },
          },
          select: { name: true },
        })
      : [];
    const skipNameSet = new Set(existingTasks.map((t) => t.name));

    // find fallback last agent once
    const lastAgent = await findLastAgentForClient(clientId);
    const overridePriority = body?.priority
      ? normalizeTaskPriority(body?.priority)
      : undefined;

    // Create payloads
    type TaskCreate = Parameters<typeof prisma.task.create>[0]["data"];
    const payloads: TaskCreate[] = [];

    for (const item of future) {
      if (skipNameSet.has(item.name)) continue;
      const catId = categoryIdByName.get(item.catName);
      if (!catId) continue;

      const assignToId =
        item.dueDate.getTime() <= todayOnly.getTime()
          ? assignToUserId || lastAgent?.id || undefined
          : lastAgent?.id || assignToUserId || undefined;

      payloads.push({
        id: makeId(),
        name: item.name,
        status: "pending" as TaskStatus,
        priority: overridePriority ?? item.src.priority,
        idealDurationMinutes: item.src.idealDurationMinutes ?? undefined,
        dueDate: toLocalMiddayISOString(item.dueDate),
        completionLink: item.src.completionLink ?? undefined,
        email: item.src.email ?? undefined,
        password: item.src.password ?? undefined,
        username: item.src.username ?? undefined,
        notes: item.src.notes ?? undefined,
        assignment: { connect: { id: assignment.id } },
        client: { connect: { id: clientId } },
        category: { connect: { id: catId } },
        ...(assignToId ? { assignedTo: { connect: { id: assignToId } } } : {}),
      });
    }

    // Social Communication (optional): latestDue = latest created due date (this run)
    const createdDates = future
      .filter((f) => !skipNameSet.has(f.name))
      .map((f) => f.dueDate.getTime());
    const latestDue = createdDates.length
      ? new Date(Math.max(...createdDates))
      : cutoff;

    const socialBases = Array.from(
      new Set(
        sourceTasks
          .filter((s) => s.templateSiteAsset?.type === "social_site")
          .map((s) => baseNameOf(s.name) || "Social")
      )
    );

    const scNames = socialBases.map(
      (b) => `${b} - ${CAT_SOCIAL_COMMUNICATION}`
    );
    const web2SCNames = WEB2_FIXED_PLATFORMS.filter((p) =>
      web2PlatformCreds.get(p)
    ).map((p) => `${PLATFORM_META[p].label} - ${CAT_SOCIAL_COMMUNICATION}`);

    const scExisting = await prisma.task.findMany({
      where: {
        assignmentId: assignment.id,
        name: { in: [...scNames, ...web2SCNames] },
        category: { name: CAT_SOCIAL_COMMUNICATION },
      },
      select: { name: true },
    });
    const scSkip = new Set(scExisting.map((t) => t.name));
    const scCatId = categoryIdByName.get(CAT_SOCIAL_COMMUNICATION);

    if (scCatId) {
      // per-base SC
      for (const base of socialBases) {
        const scName = `${base} - ${CAT_SOCIAL_COMMUNICATION}`;
        if (scSkip.has(scName)) continue;
        const src = sourceTasks.find(
          (s) =>
            s.templateSiteAsset?.type === "social_site" &&
            baseNameOf(s.name) === base
        );

        const assignToId =
          latestDue.getTime() <= todayOnly.getTime()
            ? assignToUserId || lastAgent?.id || undefined
            : lastAgent?.id || assignToUserId || undefined;

        payloads.push({
          id: makeId(),
          name: scName,
          status: "pending",
          priority: overridePriority ?? src?.priority ?? "medium",
          dueDate: latestDue.toISOString(),
          completionLink: src?.completionLink ?? undefined,
          email: src?.email ?? undefined,
          password: src?.password ?? undefined,
          username: src?.username ?? undefined,
          notes: src?.notes ?? undefined,
          assignment: { connect: { id: assignment.id } },
          client: { connect: { id: clientId } },
          category: { connect: { id: scCatId } },
          ...(assignToId
            ? { assignedTo: { connect: { id: assignToId } } }
            : {}),
        });
      }

      // Web2 fixed SC
      for (const p of WEB2_FIXED_PLATFORMS) {
        const creds = web2PlatformCreds.get(p);
        if (!creds) continue;
        const scName = `${PLATFORM_META[p].label} - ${CAT_SOCIAL_COMMUNICATION}`;
        if (scSkip.has(scName)) continue;

        const assignToId =
          latestDue.getTime() <= todayOnly.getTime()
            ? assignToUserId || lastAgent?.id || undefined
            : lastAgent?.id || assignToUserId || undefined;

        payloads.push({
          id: makeId(),
          name: scName,
          status: "pending",
          priority: overridePriority ?? "medium",
          dueDate: latestDue.toISOString(),
          username: creds.username,
          email: creds.email,
          password: creds.password,
          completionLink: creds.url,
          idealDurationMinutes: creds.idealDurationMinutes ?? undefined,
          assignment: { connect: { id: assignment.id } },
          client: { connect: { id: clientId } },
          category: { connect: { id: scCatId } },
          ...(assignToId
            ? { assignedTo: { connect: { id: assignToId } } }
            : {}),
        });
      }
    }

    if (payloads.length === 0) {
      return NextResponse.json(
        {
          message: "All scheduled tasks already exist for this renewal window.",
          created: 0,
          cutoff,
          scheduleCount: 0,
          renewalDate,
          dueDate,
          tasks: [],
        },
        { status: 200 }
      );
    }

    const created = await prisma.$transaction(
      payloads.map((data) =>
        prisma.task.create({
          data,
          select: {
            id: true,
            name: true,
            status: true,
            priority: true,
            createdAt: true,
            dueDate: true,
            idealDurationMinutes: true,
            completionLink: true,
            email: true,
            password: true,
            username: true,
            notes: true,
            assignedTo: { select: { id: true, name: true, email: true } },
            assignment: { select: { id: true } },
            category: { select: { id: true, name: true } },
            templateSiteAsset: { select: { id: true, name: true, type: true } },
          },
        })
      )
    );

    return NextResponse.json(
      {
        message: `Created ${created.length} task(s) for renewal up to cutoff with per-month caps and 1WD cadence.`,
        created: created.length,
        cutoff,
        scheduleCount: created.length,
        assignmentId: assignment.id,
        cadence:
          "first at renewalDate + 1 working days, then every +7 working days (per-month capped)",
        tasks: created,
        renewalDate,
        dueDate,
      },
      { status: 201 }
    );
  } catch (err) {
    return fail("POST.catch", err);
  }
}
