// lib/auth-client.ts
import { signOut as nextSignOut } from "next-auth/react";

function sendActivityBeacon(payload: unknown) {
  try {
    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      const blob = new Blob([JSON.stringify(payload)], {
        type: "application/json",
      });
      return (navigator as any).sendBeacon("/api/activity", blob);
    }
  } catch {}
  return false;
}

export async function signOut() {
  // 1) Try non-blocking beacon first (redirect abort সমস্যা এড়াতে)
  const activityPayload = {
    entityType: "auth",
    entityId: "self",
    action: "sign_out" as const,
  };
  const sent = sendActivityBeacon(activityPayload);

  // 2) Fallback: keepalive fetch (await না করে fire-and-forget)
  if (!sent) {
    try {
      fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activityPayload),
        keepalive: true,
        cache: "no-store",
      }).catch(() => {});
    } catch {}
  }

  // 3) NextAuth signOut → server-side /api/auth/signout হিট হবে এবং রিডাইরেক্ট করবে
  await nextSignOut({ redirect: true, callbackUrl: "/auth/sign-in" });
  return true;
}

type SignUpPayload = {
  name?: string;
  email: string;
  password: string;
  role?: string;
};

type SignUpCallbacks = {
  onRequest?: () => void;
  onSuccess?: () => void;
  onError?: (ctx: { error: Error }) => void;
};

// Minimal client-side signup helper to keep legacy UI working.
export const signUp = {
  async email(payload: SignUpPayload, callbacks?: SignUpCallbacks) {
    callbacks?.onRequest?.();
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: payload.name,
          email: payload.email,
          password: payload.password,
          roleId: payload.role,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to sign up");
      }

      callbacks?.onSuccess?.();
    } catch (error: any) {
      callbacks?.onError?.({ error: error instanceof Error ? error : new Error("Sign up failed") });
    }
  },
};

export default { signOut };
