// lib/getAuthUser.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { amScopeCheck, amCeoScopeCheck, canImpersonate } from "./impersonation";

export async function getAuthUser() {
  const session: any = await getServerSession(authOptions as any);
  const baseUser = (session?.user as any) ?? null;
  if (!baseUser?.id) return null;

  // ⬇️ Dynamic API: must await
  const store = await cookies();
  const targetId = store.get("impersonation-target")?.value || null;
  const originId = store.get("impersonation-origin")?.value || null;

  // ইমপারসোনেশন অ্যাকটিভ কিনা চেক
  if (targetId && originId && originId === baseUser.id) {
    // পারমিশন ভেরিফাই (সেফটি)
    const perm = await canImpersonate(originId);
    if (!perm.ok) {
      return baseUser; // পারমিশন নেই → ইগনোর
    }
    if (perm.roleName === "am") {
      const scope = await amScopeCheck(originId, targetId);
      if (!scope.ok) {
        return baseUser; // স্কোপ মিলেনি → ইগনোর
      }
    }
    if (perm.roleName === "am_ceo") {
      const scope = await amCeoScopeCheck(originId, targetId);
      if (!scope.ok) {
        return baseUser; // Scope failed
      }
    }

    // টার্গেট ইউজার ফুল ডেটা (রোল + পারমিশনসহ)
    const dbUser = await prisma.user.findUnique({
      where: { id: targetId },
      include: {
        role: {
          include: { rolePermissions: { include: { permission: true } } },
        },
      },
    });
    if (!dbUser) return baseUser;

    return {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      image: dbUser.image,
      role: dbUser.role?.name ?? null,
      roleId: dbUser.roleId ?? null,
      clientId: dbUser.clientId ?? null,
      permissions:
        dbUser.role?.rolePermissions.map((rp) => rp.permission.id) ?? [],
      __impersonating: true,
      __impersonatedBy: originId,
    } as any;
  }

  // নরমাল কেস: সেশন ইউজারকে এনরিচ করে রিটার্ন
  const dbUser = await prisma.user.findUnique({
    where: { id: baseUser.id },
    include: {
      role: {
        include: { rolePermissions: { include: { permission: true } } },
      },
    },
  });

  return {
    ...baseUser,
    role: dbUser?.role?.name ?? null,
    roleId: dbUser?.roleId ?? null,
    clientId: dbUser?.clientId ?? null,
    permissions:
      dbUser?.role?.rolePermissions.map((rp) => rp.permission.id) ?? [],
    __impersonating: false,
  } as any;
}

