// components/app-sidebar.tsx

"use client";

import * as React from "react";
import useSWR, { useSWRConfig } from "swr";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Table2,
  Users,
  UserPlus,
  Package,
  Boxes,
  FileText,
  Share2,
  ArrowLeftRight,
  ClipboardList,
  ListChecks,
  ClipboardCheck,
  UserCog,
  UserCircle,
  Folder,
  FolderTree,
  Key,
  ShieldCheck,
  History,
  BellRing,
  MessagesSquare,
  MessageSquareText,
  GalleryVerticalEnd,
  Settings,
  Menu,
  X,
  ChevronRight,
  BadgeCheck,
  Shield,
  ShieldOff,
  LineChart,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { useUserSession } from "@/lib/hooks/use-user-session";
import { NotificationBell } from "@/components/notification-bell";
import AuthClient from "@/lib/auth-client"; // default export

/* =========================
   Types
========================= */

type Role =
  | "admin"
  | "manager"
  | "agent"
  | "qc"
  | "am"
  | "am_ceo"
  | "data_entry"
  | "client"
  | "user";

type NavLeaf = {
  title: string;
  url: string;
  /** DB Permission.id */
  permission?: string;
};

type NavGroup = {
  title: string;
  children: NavLeaf[];
};

type NavItem = NavLeaf | NavGroup;

type RolePermResponse = {
  success: boolean;
  role?: string;
  permissions: { id: string; name: string; description?: string | null }[];
};

/* =========================
   Icons
========================= */

const ICONS: Record<string, React.ReactNode> = {
  // Dashboards
  Dashboard: <LayoutDashboard className="h-4 w-4" strokeWidth={1.75} />,
  "Data Entry Dashboard": <Table2 className="h-4 w-4" strokeWidth={1.75} />,

  // Clients
  Clients: <Users className="h-4 w-4" strokeWidth={1.75} />,
  "All Clients": <Users className="h-4 w-4" strokeWidth={1.75} />,
  "Add Client": <UserPlus className="h-4 w-4" strokeWidth={1.75} />,

  // Packages / Templates / Sales
  Package: <Package className="h-4 w-4" strokeWidth={1.75} />,
  Packages: <Package className="h-4 w-4" strokeWidth={1.75} />,
  "All Package": <Boxes className="h-4 w-4" strokeWidth={1.75} />,
  Template: <FileText className="h-4 w-4" strokeWidth={1.75} />,
  sales: <LineChart className="h-4 w-4" strokeWidth={1.75} />,

  // Reports
  Reports: <LineChart className="h-4 w-4" strokeWidth={1.75} />,
  "Monthly Report": <FileText className="h-4 w-4" strokeWidth={1.75} />,

  // Distribution
  Distribution: <Share2 className="h-4 w-4" strokeWidth={1.75} />,
  "Clients to Agents": (
    <ArrowLeftRight className="h-4 w-4" strokeWidth={1.75} />
  ),

  // Tasks
  Tasks: <ClipboardList className="h-4 w-4" strokeWidth={1.75} />,
  "All Tasks": <ListChecks className="h-4 w-4" strokeWidth={1.75} />,
  "Tasks History": <History className="h-4 w-4" strokeWidth={1.75} />,

  // Agents / Teams / Users / Roles
  Agents: <UserCog className="h-4 w-4" strokeWidth={1.75} />,
  "All Agents": <Users className="h-4 w-4" strokeWidth={1.75} />,
  "Add Agent": <UserPlus className="h-4 w-4" strokeWidth={1.75} />,
  "Team Management": <Users className="h-4 w-4" strokeWidth={1.75} />,
  "User Management": <UserCircle className="h-4 w-4" strokeWidth={1.75} />,
  "Role Permissions": <Key className="h-4 w-4" strokeWidth={1.75} />,

  // QC
  QC: <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />,
  "QC Dashboard": <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />,
  "QC Review": <ClipboardCheck className="h-4 w-4" strokeWidth={1.75} />,

  // Activity / Projects / Notifications
  "Activity Logs": <History className="h-4 w-4" strokeWidth={1.75} />,
  Projects: <FolderTree className="h-4 w-4" strokeWidth={1.75} />,
  Notifications: <BellRing className="h-4 w-4" strokeWidth={1.75} />,

  // Chat
  Chat: <MessagesSquare className="h-4 w-4" strokeWidth={1.75} />,
  "My Chat": <MessageSquareText className="h-4 w-4" strokeWidth={1.75} />,
  "Admin Chat": <MessageSquareText className="h-4 w-4" strokeWidth={1.75} />,
  "Agent Chat": <MessageSquareText className="h-4 w-4" strokeWidth={1.75} />,
  "AM Chat": <MessageSquareText className="h-4 w-4" strokeWidth={1.75} />,
  "AM CEO Chat": <MessageSquareText className="h-4 w-4" strokeWidth={1.75} />,
  "Client Chat": <MessageSquareText className="h-4 w-4" strokeWidth={1.75} />,
  "Data Entry Chat": (
    <MessageSquareText className="h-4 w-4" strokeWidth={1.75} />
  ),
  "QC Chat": <MessageSquareText className="h-4 w-4" strokeWidth={1.75} />,

  // Track Development
  "Track Your Development": (
    <TrendingUp className="h-4 w-4" strokeWidth={1.75} />
  ),
};

/* =========================
   Role base paths
========================= */

const basePath: Record<Role, string> = {
  admin: "/admin",
  manager: "/manager",
  agent: "/agent",
  qc: "/qc",
  am: "/am",
  am_ceo: "/am_ceo",
  data_entry: "/data_entry",
  client: "/client",
  user: "/client",
};

const p = (role: Role, suffix = "") => `${basePath[role]}${suffix}`;

/* =========================
   Fetcher
========================= */

const fetcher = (u: string) =>
  fetch(u, { cache: "no-store" }).then((r) =>
    r.ok ? r.json() : Promise.reject(r.status)
  );

/* =========================
   Nav model (permission-only)
========================= */

function buildNav(role: Role): NavItem[] {
  const r = role;

  return [
    // Dashboards
    { title: "Dashboard", url: p(r, ""), permission: "view_dashboard" },
    {
      title: "Data Entry Dashboard",
      url: p("data_entry", ""),
      permission: "data_entry_dashboard",
    },

    // Chat (group)
    {
      title: "Chat",
      url: p("admin", "/chat/chat_admin"),
      permission: "chat_admin",
    },
    {
      title: "Chat",
      url: p("manager", "/chat/chat_manager"),
      permission: "chat_manager",
    },
    {
      title: "Chat",
      url: p("agent", "/chat/chat_agent"),
      permission: "chat_agent",
    },
    { title: "Chat", url: p("am", "/chat/chat_am"), permission: "chat_am" },
    {
      title: "Chat",
      url: p("am_ceo", "/chat/chat_am_ceo"),
      permission: "chat_am_ceo",
    },
    {
      title: "Chat",
      url: p("client", "/chat/chat_client"),
      permission: "chat_client",
    },
    {
      title: "Chat",
      url: p("data_entry", "/chat/chat_data_entry"),
      permission: "chat_data_entry",
    },
    { title: "Chat", url: p("qc", "/chat/chat_qc"), permission: "chat_qc" },

    // Clients
    {
      title: "Clients",
      children: [
        {
          title: "All Clients",
          url: p(r, "/clients"),
          permission: "view_clients_list",
        },
        {
          title: "Add Client",
          url: p(r, "/clients/onboarding"),
          permission: "view_clients_create",
        },
      ],
    },

    // AM CEO Clients
    {
      title: "Clients",
      children: [
        {
          title: "Clients",
          url: p(r, "/am_ceo_clients"),
          permission: "view_am_ceo_clients_list",
        },
      ],
    },

    // AM Clients
    {
      title: "Clients",
      children: [
        {
          title: "Clients",
          url: p(r, "/am_clients"),
          permission: "view_am_clients_list",
        },
        {
          title: "Add Client",
          url: p(r, "/clients/onboarding"),
          permission: "view_am_clients_create",
        },
      ],
    },

    {
      title: "Package",
      url: p(r, "/packages"),
      permission: "view_packages_list",
    },
    { title: "sales", url: p(r, "/sales"), permission: "view_sales" },

    // Distribution
    {
      title: "Distribution",
      children: [
        {
          title: "Clients to Agents",
          url: p(r, "/distribution/client-agent"),
          permission: "view_distribution_client_agent",
        },
      ],
    },

    // Tasks
    {
      title: "Tasks",
      children: [
        {
          title: "All Tasks",
          url: p(r, "/tasks"),
          permission: "view_tasks_list",
        },
        {
          title: "Tasks History",
          url: p(r, "/taskHistory"),
          permission: "view_tasks_history",
        },
      ],
    },

    // Reports
    {
      title: "Reports",
      children: [
        {
          title: "Monthly Report",
          url: p(r, "/monthlyReport"),
          permission: "view_monthly_report",
        },
      ],
    },

    // Agent quick links
    {
      title: "Tasks",
      url: p("agent", "/agent_tasks"),
      permission: "view_agent_tasks",
    },
    {
      title: "Social Activity Task",
      url: p("agent", "/social-activity"),
      permission: "view_social_activities",
    },
    {
      title: "Tasks History",
      url: p("agent", "/taskHistory"),
      permission: "view_agent_tasks_history",
    },

    // QC review
    {
      title: "QC Review",
      url: p(r, "/qc/qc-review"),
      permission: "view_qc_review",
    },

    // Agents
    {
      title: "Agents",
      children: [
        {
          title: "All Agents",
          url: p(r, "/agents"),
          permission: "view_agents_list",
        },
        {
          title: "Add Agent",
          url: p(r, "/agents/create"),
          permission: "view_agents_create",
        },
      ],
    },

    // Team / Role-perms / User / Activity
    {
      title: "Team Management",
      url: p(r, "/teams"),
      permission: "view_teams_manage",
    },
    {
      title: "Role Permissions",
      url: p(r, "/role-permissions"),
      permission: "view_role_permissions",
    },
    {
      title: "User Management",
      url: p(r, "/user"),
      permission: "view_user_management",
    },
    {
      title: "Activity Logs",
      url: p(r, "/activity"),
      permission: "view_activity_logs",
    },

    // Notifications
    {
      title: "Notifications",
      url: p(r, "/notifications"),
      permission: "view_notifications",
    },

    // Track Your Development (for clients)
    {
      title: "Track Your Development",
      url: p(r, "/track-development"),
      permission: "view_track_development",
    },
  ];
}

/* =========================
   Utils
========================= */

function isGroup(item: NavItem): item is NavGroup {
  return (item as NavGroup).children !== undefined;
}

function normalizePath(u: string) {
  const noQ = u.replace(/[?#].*$/, "");
  return noQ !== "/" ? noQ.replace(/\/+$/, "") : "/";
}

function useActive(pathname: string) {
  const normPath = React.useMemo(() => normalizePath(pathname), [pathname]);
  return React.useCallback(
    (url: string) => normalizePath(url) === normPath,
    [normPath]
  );
}

function filterNavByAccess(
  items: NavItem[],
  permissionSet: Set<string> | null
) {
  const hasPerm = (perm?: string) =>
    !perm ? true : !!permissionSet?.has(perm);
  return items
    .map((it) => {
      if (isGroup(it)) {
        const kids = it.children.filter((c) => hasPerm(c.permission));
        if (kids.length === 0) return null;
        return { ...it, children: kids } as NavGroup;
      }
      return hasPerm(it.permission) ? it : null;
    })
    .filter(Boolean) as NavItem[];
}

/* =========================
   Component
========================= */

export function AppSidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [open, setOpen] = React.useState(!isMobile);
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const router = useRouter();
  const { cache, mutate } = useSWRConfig();

  // NextAuth session (original user) — fallback only
  const { user } = useUserSession();
  const sessionRole = (user?.role as Role) ?? "user";
  const sessionUserId = user?.id ?? null;
  const sessionName = user?.name || "User";
  const sessionEmail = user?.email || "";
  const sessionImage = user?.image || "";

  // Acting user (from /api/auth/me) — primary when impersonating/always preferred
  type MeResponse = {
    user?: {
      id?: string;
      role?: string | null;
      roleId?: string | null; // 🎭 IMPERSONATION FIX: Target user's role ID (required for permission fetching)
      name?: string | null;
      email?: string;
      image?: string | null;
      permissions?: string[];
    } | null;
    impersonation?: {
      isImpersonating: boolean;
      realAdmin?: { id: string; name?: string | null; email: string } | null;
    };
  };
  const { data: me } = useSWR<MeResponse>("/api/auth/me", fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  });

  // Primary role/user is from /api/auth/me; fallback to session
  const actingRole: Role =
    ((me?.user?.role as Role) || null) ?? sessionRole ?? "user";

  // 🎭 IMPERSONATION FIX: Extracting the impersonated user's role ID
  // This comes from /api/auth/me where getAuthUser() returns the full impersonated user data
  const actingRoleId: string | null =
    (me?.user?.roleId as string | undefined) ?? null;

  const actingUserId: string | null =
    (me?.user?.id as string | undefined) ?? sessionUserId;

  const displayName = (me?.user?.name as string | null) ?? sessionName;
  const displayEmail = (me?.user?.email as string | undefined) ?? sessionEmail;
  const displayImage = (me?.user?.image as string | undefined) ?? sessionImage;

  const isImpersonating = !!me?.impersonation?.isImpersonating;
  const startedBy =
    me?.impersonation?.realAdmin?.name ||
    me?.impersonation?.realAdmin?.email ||
    null;

  // Notifications — role-aware base
  const apiBaseForNotifications =
    actingRole === "am" ? "/api/am/notifications" : "/api/notifications";

  // Unread chat count
  const { data: unreadData } = useSWR<{ count: number }>(
    "/api/chat/unread-count",
    fetcher,
    { refreshInterval: 15_000, revalidateOnFocus: true }
  );
  const chatUnread = unreadData?.count ?? 0;

  /** ---------- Chat sound ---------- **/
  const chatAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const prevChatCountRef = React.useRef<number | null>(null);
  const [chatSoundEnabled, setChatSoundEnabled] = React.useState<boolean>(
    () => {
      if (typeof window === "undefined") return true;
      return (localStorage.getItem("chatSound") ?? "on") === "on";
    }
  );

  React.useEffect(() => {
    if (!chatAudioRef.current) {
      chatAudioRef.current = new Audio("/sounds/text-notify.wav");
      chatAudioRef.current.preload = "auto";
      chatAudioRef.current.volume = 1.0;
    }
  }, []);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("chatSound", chatSoundEnabled ? "on" : "off");
    }
  }, [chatSoundEnabled]);

  React.useEffect(() => {
    if (prevChatCountRef.current === null) {
      prevChatCountRef.current = chatUnread;
      return;
    }
    const prev = prevChatCountRef.current;
    if (chatSoundEnabled && Number(chatUnread) > Number(prev)) {
      chatAudioRef.current?.play().catch(() => {});
      if (typeof navigator?.vibrate === "function" && document.hidden) {
        navigator.vibrate(120);
      }
    }
    prevChatCountRef.current = chatUnread;
  }, [chatUnread, chatSoundEnabled]);

  // 🎭 IMPERSONATION FIX: Using role ID for permission fetching
  // Previously used role name (e.g., "manager"), but API endpoint expects role ID (UUID)
  // Now during impersonation, correct permissions are fetched using target user's role ID
  const permKey =
    actingUserId && actingRoleId
      ? `/api/role-permissions/${actingRoleId}?uid=${actingUserId}`
      : null;

  const { data: rolePermData } = useSWR<RolePermResponse>(permKey, fetcher, {
    revalidateOnMount: true,
    revalidateOnFocus: true,
    keepPreviousData: false,
    dedupingInterval: 0,
  });

  const permissionSet = React.useMemo<Set<string> | null>(() => {
    const list = rolePermData?.permissions ?? [];
    return rolePermData ? new Set(list.map((p) => p.id)) : null;
  }, [rolePermData]);

  const isPermLoading = permissionSet === null && !!actingUserId;

  const active = useActive(pathname);
  const nav = React.useMemo(() => buildNav(actingRole), [actingRole]);
  const visibleNav = React.useMemo(
    () => filterNavByAccess(nav, permissionSet),
    [nav, permissionSet]
  );

  // Auto behaviors
  React.useEffect(() => {
    setOpen(!isMobile);
  }, [isMobile]);

  React.useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const item of visibleNav) {
      if (isGroup(item) && item.children.some((c) => active(c.url))) {
        next[item.title] = true;
      }
    }
    setExpanded((prev) => ({ ...prev, ...next }));
  }, [visibleNav, active]);

  React.useEffect(() => {
    setExpanded({});
  }, [actingUserId, actingRole]);

  // Actions
  const handleSignOut = async () => {
    try {
      try {
        localStorage.removeItem("chat:open");
      } catch {}
      try {
        (cache as any)?.clear?.();
      } catch {}
      mutate(() => true, undefined, { revalidate: false });
      await AuthClient.signOut(); // ✅ beacon + NextAuth signOut
    } catch {
      router.push("/auth/sign-in");
      router.refresh();
    }
  };

  const handleExitImpersonation = async () => {
    try {
      await fetch("/api/impersonate/stop", { method: "POST" });
    } catch {}
    // হার্ড ন্যাভ — অরিজিনাল সেশন রোল অনুযায়ী ল্যান্ডিং
    window.location.replace("/");
  };

  return (
    <div className="relative">
      {/* Mobile Top Bar */}
      <div className="md:hidden sticky top-0 z-50 bg-white/70 backdrop-blur border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-8 h-8 bg-gradient-to-tr from-cyan-500 via-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <GalleryVerticalEnd className="h-5 w-5 text-white" />
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold">Birds Of Eden</p>
              <p className="text-[10px] text-muted-foreground">
                Enterprise Plan
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell apiBase={apiBaseForNotifications} />
            <SettingsMenu
              chatSoundEnabled={chatSoundEnabled}
              setChatSoundEnabled={setChatSoundEnabled}
              onTryUnlockAudio={async () => {
                await chatAudioRef.current?.play();
              }}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle navigation"
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <AnimatePresence initial={false}>
          {open && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="px-2 pb-2"
              aria-label="Mobile navigation"
            >
              {isPermLoading ? (
                <SidebarSkeleton />
              ) : (
                visibleNav.map((item, idx) => {
                  if (isGroup(item)) {
                    const childKeys = item.children.map((c) => c.url).join("|");
                    return (
                      <MobileItem
                        key={`group:${item.title}:${childKeys}:${idx}`}
                        item={item}
                        active={active}
                        role={actingRole}
                        expanded={expanded}
                        setExpanded={setExpanded}
                      />
                    );
                  }
                  const leaf = item as NavLeaf;
                  return (
                    <MobileItem
                      key={`leaf:${leaf.url}:${idx}`}
                      item={leaf}
                      active={active}
                      role={actingRole}
                      expanded={expanded}
                      setExpanded={setExpanded}
                    />
                  );
                })
              )}
            </motion.nav>
          )}
        </AnimatePresence>
      </div>

      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ x: open ? 0 : -300 }}
        transition={{ type: "spring", damping: 22, stiffness: 220 }}
        className={cn(
          "hidden md:flex fixed top-0 left-0 h-screen w-64 z-40 flex-col",
          "bg-gradient-to-b from-slate-50 via-white to-slate-50",
          "border-r border-gray-200/80 shadow-xl",
          className
        )}
        aria-label="Sidebar"
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-200/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-tr from-cyan-500 via-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <GalleryVerticalEnd className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold">Reputation Prime</h1>
                <p className="text-xs text-muted-foreground">Enterprise Plan</p>
              </div>
            </div>
          </div>

          {/* Role / quick actions */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-md px-2 py-0.5">
                <Shield className="h-3 w-3 mr-1" />
                {actingRole.charAt(0).toUpperCase() + actingRole.slice(1)} Area
              </Badge>
              {isImpersonating && (
                <Badge
                  variant="secondary"
                  className="bg-amber-100 text-amber-900 border-amber-200"
                >
                  Acting
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <NotificationBell apiBase={apiBaseForNotifications} />
              <SettingsMenu
                chatSoundEnabled={chatSoundEnabled}
                setChatSoundEnabled={setChatSoundEnabled}
                onTryUnlockAudio={async () => {
                  await chatAudioRef.current?.play();
                }}
              />
            </div>
          </div>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="space-y-1">
            {isPermLoading ? (
              <SidebarSkeleton />
            ) : (
              visibleNav.map((item, idx) => {
                if (isGroup(item)) {
                  const childKeys = item.children.map((c) => c.url).join("|");
                  return (
                    <GroupItem
                      key={`group:${item.title}:${childKeys}:${idx}`}
                      item={item}
                      active={active}
                      expanded={expanded}
                      setExpanded={setExpanded}
                      chatUnread={chatUnread}
                    />
                  );
                }
                const leaf = item as NavLeaf;
                return (
                  <LeafItem
                    key={`leaf:${leaf.url}:${idx}`}
                    item={leaf}
                    active={active}
                    chatUnread={chatUnread}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* Footer / Profile */}
        <SidebarFooter
          userName={displayName}
          userEmail={displayEmail}
          userImage={displayImage}
          role={actingRole}
          isImpersonating={isImpersonating}
          startedBy={startedBy}
          onExitImpersonation={handleExitImpersonation}
          onSignOut={handleSignOut}
        />
      </motion.aside>

      {/* Desktop spacer */}
      <div className="hidden md:block" style={{ width: 256 }} />
    </div>
  );
}

/* =========================
   Pieces
========================= */

function GroupItem({
  item,
  active,
  expanded,
  setExpanded,
  chatUnread,
}: {
  item: NavGroup;
  active: (url: string) => boolean;
  expanded: Record<string, boolean>;
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  chatUnread?: number;
}) {
  const isActive = item.children.some((c) => active(c.url));
  const open = !!expanded[item.title];

  return (
    <div className="space-y-1">
      <motion.button
        type="button"
        onClick={() =>
          setExpanded((s) => ({ ...s, [item.title]: !s[item.title] }))
        }
        whileHover={{ x: 2 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "w-full cursor-pointer p-2.5 rounded-lg flex items-center justify-between",
          "transition-all duration-200 group",
          "hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100/50",
          "hover:shadow-sm hover:border-gray-200/50 border border-transparent text-left",
          isActive &&
            "bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-200/50 shadow-sm"
        )}
        aria-expanded={open}
        aria-controls={`section-${item.title}`}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "p-2 rounded-lg transition-all duration-200 bg-gradient-to-br from-gray-100 to-gray-200",
              isActive && "from-cyan-500 to-blue-500 text-white shadow-md"
            )}
          >
            {ICONS[item.title] ?? <Folder className="h-4 w-4" />}
          </div>
          <span
            className={cn(
              "font-medium transition-colors duration-200 text-gray-700 group-hover:text-gray-900",
              isActive && "text-cyan-700"
            )}
          >
            {item.title}
          </span>
        </div>
        <motion.div
          animate={{
            rotate: open ? 90 : 0,
            color: isActive ? "#0891b2" : "#6b7280",
          }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRight className="h-4 w-4" />
        </motion.div>
      </motion.button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`section-${item.title}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="ml-6 space-y-1"
          >
            {item.children.map((child) => (
              <LeafItem
                key={`leaf:${child.url}`}
                item={child}
                active={active}
                chatUnread={chatUnread}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LeafItem({
  item,
  active,
  chatUnread,
}: {
  item: NavLeaf;
  active: (url: string) => boolean;
  chatUnread?: number;
}) {
  const isActive = active(item.url);
  const isChatLink =
    item.title.toLowerCase().includes("chat") || item.url.includes("/chat");

  return (
    <Link
      href={item.url}
      className={cn(
        "flex items-center gap-3 p-2.5 rounded-lg",
        "transition-all duration-200 hover:bg-gray-50",
        isActive && "bg-cyan-50 text-cyan-700 font-medium"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <div
        className={cn(
          "p-1.5 rounded-md bg-gray-100",
          isActive && "bg-cyan-100 text-cyan-700"
        )}
      >
        {ICONS[item.title] ?? <FileText className="h-4 w-4" />}
      </div>
      <span className="text-sm font-medium text-gray-700">{item.title}</span>

      {isChatLink && Number(chatUnread) > 0 && (
        <span className="ml-auto inline-flex items-center justify-center text-xs px-2 py-0.5 rounded-full bg-emerald-600 text-white">
          {chatUnread}
        </span>
      )}
    </Link>
  );
}

function MobileItem({
  item,
  active,
  role,
  expanded,
  setExpanded,
  chatUnread,
}: {
  item: NavItem;
  active: (url: string) => boolean;
  role: Role;
  expanded: Record<string, boolean>;
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  chatUnread?: number;
}) {
  if (!isGroup(item))
    return <LeafItem item={item} active={active} chatUnread={chatUnread} />;
  const open = !!expanded[item.title];
  const isActive = item.children.some((c) => active(c.url));
  return (
    <div className="rounded-lg border border-gray-200/60 overflow-hidden mb-1">
      <button
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 bg-white",
          isActive && "bg-cyan-50"
        )}
        onClick={() =>
          setExpanded((s) => ({ ...s, [item.title]: !s[item.title] }))
        }
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "p-2 rounded-lg bg-gray-100",
              isActive && "bg-cyan-100 text-cyan-700"
            )}
          >
            {ICONS[item.title] ?? <Folder className="h-4 w-4" />}
          </div>
          <span className="text-sm font-medium">{item.title}</span>
        </div>
        <ChevronRight
          className={cn("h-4 w-4 transition-transform", open && "rotate-90")}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="bg-white"
          >
            <div className="px-3 py-2 space-y-1">
              {item.children.map((c) => (
                <LeafItem
                  key={`leaf:${c.url}`}
                  item={c}
                  active={active}
                  chatUnread={chatUnread}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* =========================
   Sidebar Footer (Impersonation-aware)
========================= */

function SidebarFooter({
  userName,
  userEmail,
  userImage,
  role,
  isImpersonating,
  startedBy,
  onExitImpersonation,
  onSignOut,
}: {
  userName: string;
  userEmail?: string;
  userImage: string;
  role: Role;
  isImpersonating: boolean;
  startedBy: string | null;
  onExitImpersonation: () => void;
  onSignOut: () => void;
}) {
  const initials =
    (userName || "User")
      .split(" ")
      .map((s) => s?.[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "US";

  const roleLabel = role?.toUpperCase?.() || "USER";

  return (
    <div className="p-4 border-t border-gray-200/50 bg-gradient-to-r from-gray-50/50 to-white/50">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-xl bg-white/60 backdrop-blur-sm",
              "border border-gray-200/50 shadow-sm hover:shadow transition"
            )}
            aria-label="Account menu"
          >
            <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
              <AvatarImage src={userImage} alt={userName} />
              <AvatarFallback className="bg-gradient-to-tr from-cyan-500 to-blue-500 text-white font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-semibold text-gray-900 truncate flex items-center gap-1.5">
                {userName}
                <Badge
                  variant="secondary"
                  className="h-5 px-1.5 py-0 text-[10px]"
                >
                  {roleLabel}
                </Badge>
                {isImpersonating && (
                  <Badge
                    variant="secondary"
                    className="h-5 px-1.5 py-0 text-[10px] bg-amber-100 text-amber-900 border-amber-200"
                    title={
                      startedBy ? `Started by ${startedBy}` : "Impersonating"
                    }
                  >
                    Acting
                  </Badge>
                )}
              </p>
              <p className="text-xs text-gray-500 truncate">{userEmail}</p>
            </div>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent side="top" align="start" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Signed in as{" "}
            <span className="ml-1 font-medium text-foreground">
              {userEmail || "User"}
            </span>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <Link href="/profile" className="w-full flex items-center gap-2">
              <BadgeCheck className="h-4 w-4" /> Profile
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link href="/settings" className="w-full flex items-center gap-2">
              <Settings className="h-4 w-4" /> Settings
            </Link>
          </DropdownMenuItem>

          {isImpersonating && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onExitImpersonation}
                className="text-amber-700 focus:text-amber-800"
                title={
                  startedBy ? `Started by ${startedBy}` : "Exit impersonation"
                }
              >
                <ShieldOff className="h-4 w-4 mr-2" />
                Exit impersonation
                {startedBy ? ` (by ${startedBy})` : ""}
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="text-red-600 focus:text-red-700"
            onClick={onSignOut}
          >
            <History className="hidden" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/* =========================
   Settings Menu (Chat Sound toggle)
========================= */

function SettingsMenu({
  chatSoundEnabled,
  setChatSoundEnabled,
  onTryUnlockAudio,
}: {
  chatSoundEnabled: boolean;
  setChatSoundEnabled: (v: boolean) => void;
  onTryUnlockAudio?: () => Promise<void> | void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-gray-400 hover:text-gray-600"
          aria-label="Settings"
          title="Settings"
        >
          <Settings className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Preferences</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={async () => {
            const next = !chatSoundEnabled;
            setChatSoundEnabled(next);
            if (next && onTryUnlockAudio) {
              try {
                await onTryUnlockAudio();
              } catch {}
            }
          }}
          className="flex items-center justify-between"
        >
          <span className="flex items-center gap-2">
            <BellRing className="h-4 w-4" />
            Chat sound
          </span>
          <Badge
            variant={chatSoundEnabled ? "default" : "secondary"}
            className={chatSoundEnabled ? "bg-emerald-600 text-white" : ""}
          >
            {chatSoundEnabled ? "On" : "Off"}
          </Badge>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* =========================
   Loading Skeleton
========================= */

function SidebarSkeleton() {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="h-8 bg-gray-100 rounded-md animate-pulse" />
      ))}
    </div>
  );
}
