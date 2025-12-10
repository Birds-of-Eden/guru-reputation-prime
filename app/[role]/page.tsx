// app/[role]/page.tsx
import { getAuthUser } from "@/lib/getAuthUser";
import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";

import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { AMCeoDashboard } from "@/components/am_ceo/amCeoDashboard";
import { AMDashboard } from "@/components/account_manager/amDashboard";
import QCDashboard from "@/components/QCDashboard";
import { AgentDashboard } from "@/components/agent-dashboard";
import ClientSelfDashboard from "@/components/client-self-dashboard";
import ClientsPage from "./data_entry/clients/page";

export const dynamic = "force-dynamic";

type Role =
  | "admin"
  | "manager"
  | "agent"
  | "qc"
  | "am"
  | "am_ceo"
  | "data_entry"
  | "client";

async function fetchQcTasks() {
  noStore();

  // ✅ Next.js 15: Dynamic APIs are async
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return [];

  const baseUrl = `${proto}://${host}`;

  // ✅ cookies() await করে নিন
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  try {
    const res = await fetch(`${baseUrl}/api/tasks`, {
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : {},
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export default async function RoleBasedPage({
  params,
}: {
  params: Promise<{ role: Role }>;
}) {
  await params; // Next.js 15 requires the params promise even when unused
  const user = await getAuthUser();
  if (!user) redirect("/auth/sign-in");

  const role = ((user as any).role || "client") as Role;

  switch (role) {
    case "admin":
    case "manager":
      return <AdminDashboard />;

    case "agent":
      if (!user.id) {
        return (
          <div className="flex items-center justify-center min-h-[300px]">
            <p className="text-sm text-red-600">
              Could not determine agent ID. Please re-login.
            </p>
          </div>
        );
      }
      return <AgentDashboard agentId={user.id} />;

    case "qc": {
      const tasks = await fetchQcTasks();
      return <QCDashboard tasks={tasks} />;
    }

    case "am":
      return <AMDashboard />;

    case "am_ceo":
      return <AMCeoDashboard />;

    case "data_entry":
      return <ClientsPage />;

    case "client":
    default:
      return <ClientSelfDashboard />;
  }
}
