// lib/activity.ts
import prisma from "@/lib/prisma"
import { pusherServer } from "@/lib/pusher/server"

type CreateLogArgs = {
  entityType: string
  entityId: string
  action: "sign_in" | "sign_out" | string
  details?: unknown
  userId?: string
}

export async function createActivityLog({
  entityType,
  entityId,
  action,
  details,
  userId,
}: CreateLogArgs) {
  const log = await prisma.activityLog.create({
    data: {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      entityType,
      entityId,
      action,
      details: (details ?? undefined) as any,
      userId,
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  })

  try {
    await pusherServer.trigger("activity", "activity:new", {
      id: log.id,
      entityType: log.entityType,
      entityId: log.entityId,
      action: log.action,
      details: log.details,
      timestamp: (log as any).timestamp ?? new Date().toISOString(),
    })
  } catch {}

  return log
}
