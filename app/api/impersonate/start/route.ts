// app/api/impersonate/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { randomUUID } from "crypto";
import {
  canImpersonate,
  amScopeCheck,
  amCeoScopeCheck,
} from "@/lib/impersonation";

function isSecure(req: NextRequest) {
  const proto =
    req.headers.get("x-forwarded-proto") ??
    // @ts-expect-error - nextUrl.protocol exists in Next runtime
    req.nextUrl?.protocol?.replace(":", "") ??
    "http";
  return proto === "https";
}

export async function POST(req: NextRequest) {
  try {
    const { targetUserId } = await req.json();
    if (!targetUserId) {
      return NextResponse.json(
        { error: "targetUserId is required" },
        { status: 400 }
      );
    }

    // ✅ NextAuth-এর বর্তমান সেশন (অ্যাডমিন/AM/ইত্যাদি)
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const actorUserId = session.user.id;

    // ✅ পারমিশন চেক
    const perm = await canImpersonate(actorUserId);
    if (!perm.ok) {
      return NextResponse.json(
        { error: "Not allowed to impersonate" },
        { status: 403 }
      );
    }

    const actorRoleName = (perm.roleName ?? "").toLowerCase();

    // ✅ AM-স্কোপ গার্ড (যদি actor AM হয়)
    if (actorRoleName === "am") {
      const scope = await amScopeCheck(actorUserId, targetUserId);
      if (!scope.ok) {
        return NextResponse.json({ error: scope.reason }, { status: 403 });
      }
    }

    if (actorRoleName === "am_ceo") {
      const scope = await amCeoScopeCheck(actorUserId, targetUserId);
      if (!scope.ok) {
        return NextResponse.json({ error: scope.reason }, { status: 403 });
      }
    }

    // 🎯 টার্গেট ইউজার + রোল
    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        name: true,
        role: { select: { name: true } },
      },
    });

    if (!target) {
      return NextResponse.json(
        { error: "Target user not found" },
        { status: 404 }
      );
    }

    // 🔐 রোল ডিটারমিনেশন
    const actorRole = (
      perm.roleName ??
      session.user.role?.name ??
      ""
    ).toLowerCase();
    const targetRole = target.role?.name?.toLowerCase() ?? "";

    // 🧱 HARD GUARD: শুধুমাত্র অ্যাডমিনই অ্যাডমিনকে ইমপারসোনেট করতে পারবে
    if (targetRole === "admin" && actorRole !== "admin") {
      return NextResponse.json(
        { error: "Only admins can impersonate admin users" },
        { status: 403 }
      );
    }

    // ✅ অডিট লগ
    await prisma.activityLog.create({
      data: {
        id: randomUUID(),
        entityType: "auth",
        entityId: target.id,
        userId: actorUserId,
        action: "impersonate_start",
        details: { targetUserId: target.id },
      },
    });

    // ✅ ৩ ঘন্টার জন্য ইমপারসোনেশন কুকি সেট
    const res = NextResponse.json(
      {
        success: true,
        message: `Now impersonating ${target.email || target.id}`,
        actingUser: { id: target.id, name: target.name, email: target.email },
      },
      { status: 200 }
    );

    const secure = isSecure(req);
    const maxAge = 3 * 60 * 60; // 3 hours

    // 🧭 অরিজিনাল ইউজার সংরক্ষণ (UI/স্টপের জন্য দরকার)
    res.cookies.set("impersonation-origin", session.user.id, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge,
    });

    // 🎭 টার্গেট ইউজার সেট
    res.cookies.set("impersonation-target", target.id, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge,
    });

    // 🎭 IMPERSONATION FIX: Store target user's role in cookie
    // Reason: Middleware runs in Edge Runtime where Prisma/Database access is not available
    // Therefore, middleware can read the impersonated user's role directly from cookie
    // This enables proper route access control and fixes menu navigation issues
    res.cookies.set("impersonation-role", targetRole, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge,
    });

    return res;
  } catch (e) {
    console.error("impersonate/start error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
