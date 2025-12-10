// app/api/chat/conversations/route.ts

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/getAuthUser";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type ConversationContext = {
  clientId?: string | null;
  teamId?: string | null;
  assignmentId?: string | null;
  taskId?: string | null;
};

const CONTEXT_KEYS: (keyof ConversationContext)[] = [
  "clientId",
  "teamId",
  "assignmentId",
  "taskId",
];

type ConversationWithMeta = Prisma.ConversationGetPayload<{
  include: {
    participants: {
      include: { user: { select: { id: true; name: true; image: true } } };
    };
    messages: { take: 1; orderBy: { createdAt: "desc" } };
  };
}> & { conversation_field_06?: Prisma.JsonValue | null };

function buildConversationContext(context: ConversationContext) {
  const payload: Record<string, string> = {};
  for (const key of CONTEXT_KEYS) {
    const value = context[key];
    if (typeof value === "string" && value.trim().length > 0) {
      payload[key] = value;
    }
  }
  return Object.keys(payload).length ? payload : undefined;
}

function applyConversationContext(conversation: ConversationWithMeta) {
  const raw = conversation.conversation_field_06;
  const meta =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  return {
    ...conversation,
    clientId: (meta.clientId as string | null | undefined) ?? null,
    teamId: (meta.teamId as string | null | undefined) ?? null,
    assignmentId: (meta.assignmentId as string | null | undefined) ?? null,
    taskId: (meta.taskId as string | null | undefined) ?? null,
  };
}

type ConversationWithContext = ReturnType<typeof applyConversationContext>;

function contextFilter(
  field: keyof ConversationContext,
  value?: string
): Record<string, unknown> | undefined {
  if (!value) return undefined;
  return {
    conversation_field_06: {
      path: [field],
      equals: value,
    },
  };
}

// POST /api/chat/conversations  → create
export async function POST(req: Request) {
  const me = await getAuthUser();
  if (!me)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const {
    type = "dm",
    title,
    memberIds = [],
    clientId,
    teamId,
    assignmentId,
    taskId,
  } = (await req.json()) || {};

  const normalizedTitle =
    typeof title === "string" ? title.trim() : "";
  if (type === "group" && !normalizedTitle) {
    return NextResponse.json(
      { message: "Group title is required" },
      { status: 400 }
    );
  }

  // Enforce: clients may only create a DM with their assigned AM
  const roleName = (me as any)?.role?.name?.toLowerCase?.() || "";
  if (roleName === "client") {
    // fetch client's AM
    const myClientId = (me as any)?.clientId || null;
    if (!myClientId) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const client = await prisma.client.findUnique({
      where: { id: myClientId },
      select: { amId: true },
    });
    const amId = client?.amId || null;
    // Only allowed if: type === 'dm' and memberIds contain only AM (besides me)
    const others = (Array.isArray(memberIds) ? memberIds : []).filter(
      (id: string) => id && id !== me.id
    );
    const onlyAM = others.length === 1 && amId && others[0] === amId;
    if (type !== "dm" || !onlyAM) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
  }

  const uniqueMemberIds = Array.from(new Set([...memberIds, me.id]));

  // Enforce: Agent may only create DM and cannot target AM/account manager or client
  if (roleName === "agent") {
    if (type !== "dm") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    const others = uniqueMemberIds.filter((id) => id !== me.id);
    if (others.length !== 1) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    const otherId = others[0];
    const target = await prisma.user.findUnique({ where: { id: otherId }, include: { role: true } });
    const targetRole = target?.role?.name?.toLowerCase?.() || "";
    if (["client", "am", "account manager", "account_manager"].includes(targetRole)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
  }

  // Enforce: AM may only create DM with allowed targets (admin/manager or AM's client)
  if (["am", "account manager", "account_manager"].includes(roleName)) {
    // Only DM allowed
    if (type !== "dm") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    const others = uniqueMemberIds.filter((id) => id !== me.id);
    if (others.length !== 1) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    const otherId = others[0];
    const target = await prisma.user.findUnique({ where: { id: otherId }, include: { role: true } });
    if (!target) {
      return NextResponse.json({ message: "Invalid member" }, { status: 400 });
    }
    const targetRole = target.role?.name?.toLowerCase?.() || "";
    let allowed = targetRole === "admin" || targetRole === "manager";
    if (!allowed) {
      const tClientId = (target as any)?.clientId || null;
      if (tClientId) {
        const count = await prisma.client.count({ where: { id: tClientId, amId: me.id } });
        allowed = count > 0;
      }
    }
    if (!allowed) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
  }

  const contextPayload = buildConversationContext({
    clientId,
    teamId,
    assignmentId,
    taskId,
  });

  const createData: Record<string, unknown> = {
    type,
    title: normalizedTitle || null,
    createdBy: { connect: { id: me.id } },
    participants: {
      create: uniqueMemberIds.map((uid) => ({
        userId: uid,
        role: uid === me.id ? "owner" : "member",
      })),
    },
  };

  if (contextPayload) {
    createData.conversation_field_06 = contextPayload;
  }

  const conv = await prisma.conversation.create({
    data: createData as Prisma.ConversationCreateInput,
    include: {
      participants: {
        include: { user: { select: { id: true, name: true, image: true } } },
      },
      messages: { take: 1, orderBy: { createdAt: "desc" } },
    },
  });

  return NextResponse.json(applyConversationContext(conv), { status: 201 });
}

// GET /api/chat/conversations  → my list
export async function GET(req: Request) {
  const me = await getAuthUser();
  if (!me)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const u = new URL(req.url);
  const take = Number(u.searchParams.get("take") || 30);
  const cursor = u.searchParams.get("cursor") || undefined;
  const filterType = (u.searchParams.get("type") || undefined) as
    | "dm"
    | "group"
    | "client"
    | "team"
    | "assignment"
    | "task"
    | "support"
    | undefined;
  const filterTeamId = u.searchParams.get("teamId") || undefined;

  const cps = await prisma.conversationParticipant.findMany({
    where: { userId: me.id },
    take,
    ...(cursor
      ? {
          skip: 1,
          cursor: {
            conversationId_userId: { conversationId: cursor, userId: me.id },
          },
        }
      : {}),
    select: { conversationId: true, lastReadAt: true },
    orderBy: { joinedAt: "desc" },
  });

  const convIds = cps.map((c) => c.conversationId);
  const conversationWhere: Prisma.ConversationWhereInput &
    Record<string, unknown> = {
    id: { in: convIds },
    ...(filterType ? { type: filterType } : {}),
  };
  const teamFilter = contextFilter("teamId", filterTeamId);
  if (teamFilter) {
    Object.assign(conversationWhere, teamFilter);
  }

  const conversationsRaw = (await prisma.conversation.findMany({
    where: conversationWhere,
    include: {
      participants: {
        include: { user: { select: { id: true, name: true, image: true } } },
      },
      messages: { take: 1, orderBy: { createdAt: "desc" } },
    },
  })) as ConversationWithMeta[];

  const conversations: ConversationWithContext[] = conversationsRaw.map(
    applyConversationContext
  );

  const lastReadBy: Record<string, Date | null> = {};
  cps.forEach((c) => (lastReadBy[c.conversationId] = c.lastReadAt ?? null));

  // compute unread and last activity time
  const withUnread = await Promise.all(
    conversations.map(async (conv) => {
      const lastReadAt = lastReadBy[conv.id] ?? new Date(0);
      const unreadCount = await prisma.chatMessage.count({
        where: {
          conversationId: conv.id,
          createdAt: { gt: lastReadAt },
          senderId: { not: me.id },
          deletedAt: null,
        },
      });
      const lastMsgAt = conv.messages?.[0]?.createdAt || conv.updatedAt;
      return { ...conv, unreadCount, _lastActivityAt: lastMsgAt } as any;
    })
  );

  // Sort by most recent activity desc
  withUnread.sort((a: any, b: any) => {
    const ta = new Date(a._lastActivityAt).getTime();
    const tb = new Date(b._lastActivityAt).getTime();
    return tb - ta;
  });

  // Strip helper field before returning
  const result = withUnread.map(({ _lastActivityAt, ...rest }: any) => rest);
  return NextResponse.json(result);
}
