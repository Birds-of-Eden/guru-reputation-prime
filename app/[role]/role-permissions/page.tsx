// app/[role]/role-permissions/page.tsx

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { Toaster, toast } from "sonner";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useSWRConfig } from "swr";
import {
  Search,
  Plus,
  Edit,
  Users,
  Shield,
  CheckSquare,
  Square,
  Filter,
  ChevronDown,
  ChevronUp,
  Trash2,
  X,
  DollarSign, // 🆕 for Sales category icon
} from "lucide-react";

type Role = {
  id: string;
  name: string;
  description?: string | null;
  _count?: { users: number };
};

type Permission = {
  id: string;
  name: string;
  description?: string | null;
  category?: string;
};

type PermissionCategory = {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
};

// ✅ Explicit permission → category mapping so they never fall into "Others"
const PERMISSION_CATEGORY_MAP: Record<string, string> = {
  // ---- Tasks ----
  view_social_activities: "tasks",

  // ---- Admin / Management ----
  view_role_permissions: "admin",
  view_teams_manage: "admin",
  view_user_management: "admin",

  // ---- System ----
  view_activity_logs: "system",

  // ---- Notifications ----
  view_notifications: "notifications",

  // ---- Templates ----
  template_edit: "templates",
  template_delete: "templates",

  // ---- User Management ----
  user_delete: "user_management",
  user_edit: "user_management",
  user_view: "user_management",

  // ---- Impersonation ----
  user_impersonate: "impersonate",

  // ---- Clients specific ----
  client_card_client_view: "clients",
  client_card_task_view: "clients",
  client_create: "clients",
  view_clients_list: "clients",
  view_clients_create: "clients",

  // ⭐ Your requested 4 to Clients:
  client_card_delete: "clients",
  client_card_Upgrade_Package: "clients",
  delete_article_topic: "clients",
  generate_biography: "clients",

  // 🧳 Packages
  view_packages_list: "packages",
  view_distribution_client_agent: "packages",
  // ⭐ Your requested 1 to Packages:
  package_create: "packages",
  // (optionally keep these in packages too if you like)
  package_edit: "packages",
  package_delete: "packages",

  // ---- Sales ----
  view_sales: "sales",

  // ---- Chat (explicit examples; heuristic also covers) ----
  chat_admin: "chat",
  chat_agent: "chat",
  chat_am: "chat",
  chat_am_ceo: "chat",
  chat_client: "chat",
  chat_data_entry: "chat",
  chat_qc: "chat",

  // ---- Dashboards ----
  view_dashboard: "dashboard",
  data_entry_dashboard: "dashboard",

  // ---- Reports ----
  view_monthly_report: "monthly_report",

  // ---- QC ----
  view_qc_dashboard: "qc",
  view_qc_review: "qc",

  // ---- Agents ----
  view_agents_list: "agents",
  view_agents_create: "agents",

  // ---- AM / AM CEO (will fall back to Clients/Sales heuristics too) ----
  view_am_clients_list: "clients",
  view_am_ceo_clients_list: "clients",
  view_am_clients_create: "clients",
};

export default function RolePermissionPage() {
  const { mutate } = useSWRConfig();
  const { user } = useAuth();

  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);

  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [permLoading, setPermLoading] = useState(false);

  const [selectedRole, setSelectedRole] = useState<{
    id: string;
    permissions: string[];
  } | null>(null);

  // UI state
  const [search, setSearch] = useState("");
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formRole, setFormRole] = useState<{
    name: string;
    description?: string;
  }>({
    name: "",
    description: "",
  });
  const [submittingRole, setSubmittingRole] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<{
    open: boolean;
    role: Role | null;
  }>({ open: false, role: null });

  const [expandedCategories, setExpandedCategories] = useState<
    Record<string, boolean>
  >({});
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // ✅ ensure auto-select runs only once after roles load
  const hasAutoSelected = useRef(false);

  // Categories (with icons)
  const permissionCategories: PermissionCategory[] = [
    {
      id: "dashboard",
      name: "Dashboards",
      description: "Access to various dashboard views",
      icon: (
        <div className="w-5 h-5 bg-blue-100 rounded-md flex items-center justify-center text-blue-600">
          <Shield size={14} />
        </div>
      ),
    },
    {
      id: "chat",
      name: "Chat",
      description: "Access to chat features and specific chat links",
      icon: (
        <div className="w-5 h-5 bg-purple-100 rounded-md flex items-center justify-center text-purple-600">
          <Users size={14} />
        </div>
      ),
    },
    {
      id: "clients",
      name: "Clients",
      description: "Client management and viewing permissions",
      icon: (
        <div className="w-5 h-5 bg-green-100 rounded-md flex items-center justify-center text-green-600">
          <Users size={14} />
        </div>
      ),
    },
    {
      id: "packages",
      name: "Packages",
      description: "Package management and distribution",
      icon: (
        <div className="w-5 h-5 bg-yellow-100 rounded-md flex items-center justify-center text-yellow-600">
          <Shield size={14} />
        </div>
      ),
    },
    {
      id: "templates",
      name: "Templates",
      description: "Template editing & deletion",
      icon: (
        <div className="w-5 h-5 bg-fuchsia-100 rounded-md flex items-center justify-center text-fuchsia-600">
          <Shield size={14} />
        </div>
      ),
    },
    {
      id: "tasks",
      name: "Tasks",
      description: "Task management and viewing",
      icon: (
        <div className="w-5 h-5 bg-orange-100 rounded-md flex items-center justify-center text-orange-600">
          <CheckSquare size={14} />
        </div>
      ),
    },
    {
      id: "qc",
      name: "Quality Control",
      description: "Quality control dashboard and review",
      icon: (
        <div className="w-5 h-5 bg-red-100 rounded-md flex items-center justify-center text-red-600">
          <Shield size={14} />
        </div>
      ),
    },
    {
      id: "agents",
      name: "Agents",
      description: "Agent management and viewing",
      icon: (
        <div className="w-5 h-5 bg-indigo-100 rounded-md flex items-center justify-center text-indigo-600">
          <Users size={14} />
        </div>
      ),
    },
    {
      id: "admin",
      name: "Admin/Management",
      description: "Administrative and management features",
      icon: (
        <div className="w-5 h-5 bg-gray-100 rounded-md flex items-center justify-center text-gray-600">
          <Shield size={14} />
        </div>
      ),
    },
    {
      id: "user_management",
      name: "User Management",
      description: "View, edit and delete user records",
      icon: (
        <div className="w-5 h-5 bg-sky-100 rounded-md flex items-center justify-center text-sky-600">
          <Users size={14} />
        </div>
      ),
    },
    {
      id: "impersonate",
      name: "Impersonation",
      description: "Assume another user's identity for support",
      icon: (
        <div className="w-5 h-5 bg-amber-100 rounded-md flex items-center justify-center text-amber-600">
          <Shield size={14} />
        </div>
      ),
    },
    {
      id: "system",
      name: "System",
      description: "System utilities and activity logs",
      icon: (
        <div className="w-5 h-5 bg-pink-100 rounded-md flex items-center justify-center text-pink-600">
          <Shield size={14} />
        </div>
      ),
    },
    // Dedicated Notifications category
    {
      id: "notifications",
      name: "Notifications",
      description: "In-app notifications related permissions",
      icon: (
        <div className="w-5 h-5 bg-teal-100 rounded-md flex items-center justify-center text-teal-600">
          <Shield size={14} />
        </div>
      ),
    },
    // 🆕 Sales category
    {
      id: "sales",
      name: "Sales",
      description: "Sales dashboards and reports",
      icon: (
        <div className="w-5 h-5 bg-emerald-100 rounded-md flex items-center justify-center text-emerald-600">
          <DollarSign size={14} />
        </div>
      ),
    },
    // 🆕 Monthly Report category
    {
      id: "monthly_report",
      name: "Monthly Report",
      description: "Access to Monthly Report",
      icon: (
        <div className="w-5 h-5 bg-violet-100 rounded-md flex items-center justify-center text-violet-600">
          <Shield size={14} />
        </div>
      ),
    },
  ];

  // Categorize permissions (explicit map → heuristic fallback → uncategorized)
  const categorizedPermissions = useMemo(() => {
    const categorized: Record<string, Permission[]> = {};

    // Initialize known categories
    permissionCategories.forEach((cat) => {
      categorized[cat.id] = [];
    });

    // Fallback bucket
    categorized["uncategorized"] = [];

    permissions.forEach((permission) => {
      // 1) Explicit mapping wins
      const mapped = PERMISSION_CATEGORY_MAP[permission.id];
      if (mapped && categorized[mapped]) {
        categorized[mapped].push(permission);
        return;
      }

      // 2) Heuristic fallback
      let foundCategory = false;
      for (const category of permissionCategories) {
        if (
          permission.id.includes(category.id) ||
          (permission.description &&
            permission.description
              .toLowerCase()
              .includes(category.name.toLowerCase()))
        ) {
          categorized[category.id].push(permission);
          foundCategory = true;
          break;
        }
      }

      // 3) Uncategorized if nothing matched
      if (!foundCategory) {
        categorized["uncategorized"].push(permission);
      }
    });

    return categorized;
  }, [permissions]);

  // ---------------- Loaders ----------------
  const loadRoles = async () => {
    try {
      setRolesLoading(true);
      const res = await fetch("/api/roles", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load roles");
      setRoles(Array.isArray(data.data) ? data.data : []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load roles");
    } finally {
      setRolesLoading(false);
    }
  };

  const loadPermissions = async () => {
    try {
      setPermLoading(true);
      const res = await fetch("/api/permissions", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load permissions");
      setPermissions(Array.isArray(data.data) ? data.data : []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load permissions");
    } finally {
      setPermLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
    loadPermissions();
     
  }, []);

  const loadRolePermissions = async (roleId: string) => {
    try {
      const res = await fetch(`/api/role-permissions/${roleId}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data?.error || "Failed to load role permissions");
      setSelectedRole({
        id: roleId,
        permissions: (data.permissions || []).map((p: any) => p.id),
      });
    } catch (e: any) {
      toast.error(e.message || "Failed to load role permissions");
    }
  };

  // ✅ Auto-select Admin (or first role) once roles are loaded
  useEffect(() => {
    if (hasAutoSelected.current) return;
    if (!roles || roles.length === 0) return;
    if (selectedRole) return;

    const adminLike = roles.find(
      (r) =>
        r.name?.toLowerCase() === "admin" ||
        r.id?.toLowerCase() === "admin" ||
        r.name?.toLowerCase() === "administrator"
    );
    const pick = adminLike ?? roles[0];
    if (pick?.id) {
      hasAutoSelected.current = true;
      loadRolePermissions(pick.id);
    }
  }, [roles, selectedRole]);

  // ---------------- CRUD: Roles ----------------
  const openCreateRole = () => {
    setEditingRole(null);
    setFormRole({ name: "", description: "" });
    setShowRoleModal(true);
  };

  const openEditRole = (role: Role) => {
    setEditingRole(role);
    setFormRole({ name: role.name, description: role.description || "" });
    setShowRoleModal(true);
  };

  const submitRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingRole(true);
    try {
      if (editingRole) {
        // UPDATE
        const res = await fetch(`/api/roles/${editingRole.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formRole.name,
            description: formRole.description,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to update role");

        toast.success("Role updated");
      } else {
        // CREATE (server auto-generates id)
        const res = await fetch("/api/roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formRole.name,
            description: formRole.description,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to create role");

        toast.success("Role created");
      }
      setShowRoleModal(false);
      await loadRoles();
    } catch (e: any) {
      toast.error(e.message || "Role save failed");
    } finally {
      setSubmittingRole(false);
    }
  };

  const confirmDeleteRole = (role: Role) =>
    setConfirmDelete({ open: true, role });

  const doDeleteRole = async () => {
    if (!confirmDelete.role) return;
    try {
      const res = await fetch(`/api/roles/${confirmDelete.role.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to delete role");
      toast.success("Role deleted");
      if (selectedRole?.id === confirmDelete.role.id) setSelectedRole(null);
      await loadRoles();
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    } finally {
      setConfirmDelete({ open: false, role: null });
    }
  };

  // ---------------- Toggle Permission ----------------
  const togglePermission = async (permissionId: string, checked: boolean) => {
    if (!selectedRole) return;

    try {
      if (checked) {
        const res = await fetch("/api/role-permissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roleId: selectedRole.id, permissionId }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d?.error || "Failed to assign permission");
        }
      } else {
        const res = await fetch(`/api/role-permissions/${selectedRole.id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ permissionId }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d?.error || "Failed to remove permission");
        }
      }
      await loadRolePermissions(selectedRole.id); // ডানপাশের তালিকা রিফ্রেশ
      await mutate("/api/auth/me"); // 🔄 সাথে সাথে পুরো অ্যাপের পারমিশন রি-ফেচ
      await mutate(
        (
          key: any // ঐচ্ছিক: সংশ্লিষ্ট সব কী রি-ফেচ
        ) => typeof key === "string" && key.startsWith("/api/role-permissions")
      );
      toast.success("Permissions updated");
    } catch (e: any) {
      toast.error(e.message || "Failed to update permission");
    }
  };

  // ---------------- Derived ----------------
  const filteredRoles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter(
      (r) => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)
    );
  }, [roles, search]);

  const selectedRoleMeta = useMemo(
    () => roles.find((r) => r.id === selectedRole?.id),
    [roles, selectedRole?.id]
  );

  // Toggle category expansion
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  // Filter permissions by category (chip filter)
  const filteredPermissions = useMemo(() => {
    if (filterCategory === "all") return categorizedPermissions;
    return {
      [filterCategory]: categorizedPermissions[filterCategory] || [],
    };
  }, [categorizedPermissions, filterCategory]);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <Toaster position="top-right" />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          Role & Permissions Management
        </h1>
        <p className="text-gray-600">
          Manage user roles and their permissions across the system
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* ---------- Left: Role List ---------- */}
        <section className="lg:col-span-1 rounded-xl border bg-white shadow-sm">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <Users size={18} className="text-blue-500" />
                Roles
              </h2>
              <p className="text-sm text-gray-500">
                {rolesLoading ? "Loading…" : `${roles.length} total`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={openCreateRole}
                className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1"
              >
                <Plus size={16} />
                <span>New</span>
              </button>
            </div>
          </div>

          <div className="p-4 border-b">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search roles…"
                className="w-full rounded-lg border pl-10 pr-3 py-2 outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          </div>

          <ul className="divide-y max-h-[70vh] overflow-auto">
            {rolesLoading ? (
              // Skeleton for roles
              Array.from({ length: 5 }).map((_, index) => (
                <li key={`skeleton-${index}`} className="p-4">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </li>
              ))
            ) : (
              filteredRoles.map((role) => (
              <li
                key={role.id}
                className={cn(
                  "p-4 transition-colors",
                  selectedRole?.id === role.id
                    ? "bg-blue-50 border-l-4 border-l-blue-500"
                    : "hover:bg-gray-50"
                )}
              >
                <div className="flex items-center justify-between">
                  <button
                    className="text-left flex-1"
                    onClick={() => loadRolePermissions(role.id)}
                    title="Select to manage permissions"
                  >
                    <div
                      className={cn(
                        "text-sm font-medium",
                        selectedRole?.id === role.id
                          ? "text-blue-700"
                          : "text-gray-800"
                      )}
                    >
                      {role.name.toUpperCase()}
                    </div>
                    {role.description && (
                      <div className="text-xs text-gray-500 mt-1">
                        {role.description}
                      </div>
                    )}
                    {!!role._count?.users && (
                      <div className="text-xs text-gray-500 mt-1">
                        {role._count.users} user(s)
                      </div>
                    )}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditRole(role)}
                      className="p-1.5 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                      title="Edit role"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => confirmDeleteRole(role)}
                      className="p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50"
                      title="Delete role"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </li>
            ))
            )}

            {!rolesLoading && filteredRoles.length === 0 && (
              <li className="p-4 text-sm text-gray-500 text-center">
                No roles found.
              </li>
            )}
          </ul>
        </section>

        {/* ---------- Right: Permission Manager ---------- */}
        <section className="lg:col-span-3 rounded-xl border bg-white shadow-sm">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <Shield size={18} className="text-blue-500" />
                Permissions
              </h2>
              <p className="text-sm text-gray-500">
                {permLoading
                  ? "Loading…"
                  : `${permissions.length} available permissions`}
              </p>
            </div>

            {selectedRole ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  Managing permissions for:
                </span>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                  {selectedRoleMeta?.name || selectedRole.id}
                </span>
              </div>
            ) : (
              <div className="text-sm text-gray-400 flex items-center gap-1">
                <Shield size={16} />
                Select a role to manage permissions
              </div>
            )}
          </div>

          {selectedRole && (
            <div className="p-4 border-b bg-gray-50">
              <div className="flex items-center gap-3 mb-3">
                <Filter size={16} className="text-gray-500" />
                <span className="text-sm font-medium text-gray-700">
                  Filter by category:
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFilterCategory("all")}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm transition-colors",
                    filterCategory === "all"
                      ? "bg-blue-100 text-blue-800 border border-blue-200"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  )}
                >
                  All Categories
                </button>

                {permissionCategories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setFilterCategory(category.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm transition-colors flex items-center gap-2",
                      filterCategory === category.id
                        ? "bg-blue-100 text-blue-800 border border-blue-200"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    )}
                  >
                    {category.icon}
                    {category.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="p-4">
            {!selectedRole && (
              <div className="text-center py-12">
                <Shield size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">
                  Select a role to manage its permissions
                </p>
              </div>
            )}

            {permLoading && selectedRole && (
              // Skeleton for permissions grid
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={`skeleton-cat-${index}`} className="border rounded-lg overflow-hidden">
                    <div className="p-4 bg-gray-50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-5 w-5 rounded-md" />
                        <div className="space-y-2">
                          <Skeleton className="h-5 w-32" />
                          <Skeleton className="h-4 w-48" />
                        </div>
                      </div>
                      <Skeleton className="h-5 w-5" />
                    </div>
                    <div className="p-4 bg-white grid grid-cols-1 md:grid-cols-2 gap-3">
                      {Array.from({ length: 4 }).map((_, idx) => (
                        <div key={`skeleton-perm-${idx}`} className="flex items-start gap-3 rounded-lg border p-3">
                          <Skeleton className="h-5 w-5 mt-0.5" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-48" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedRole && !permLoading && (
              <div className="space-y-4">
                {Object.entries(filteredPermissions).map(
                  ([categoryId, perms]) => {
                    if (perms.length === 0) return null;

                    const category = permissionCategories.find(
                      (c) => c.id === categoryId
                    ) || {
                      id: categoryId,
                      name:
                        categoryId === "uncategorized"
                          ? "Other Permissions"
                          : categoryId,
                      description: "Uncategorized permissions",
                      icon: <Shield size={14} />,
                    };

                    const isExpanded = expandedCategories[categoryId] ?? true;

                    return (
                      <div
                        key={categoryId}
                        className="border rounded-lg overflow-hidden"
                      >
                        <button
                          className="w-full p-4 bg-gray-50 flex items-center justify-between text-left"
                          onClick={() => toggleCategory(categoryId)}
                        >
                          <div className="flex items-center gap-3">
                            {category.icon}
                            <div>
                              <h3 className="font-medium text-gray-800">
                                {category.name}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {category.description}
                              </p>
                            </div>
                          </div>
                          <div className="text-gray-400">
                            {isExpanded ? (
                              <ChevronUp size={20} />
                            ) : (
                              <ChevronDown size={20} />
                            )}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="p-4 bg-white grid grid-cols-1 md:grid-cols-2 gap-3">
                            {perms.map((p) => {
                              const checked = selectedRole.permissions.includes(
                                p.id
                              );
                              return (
                                <label
                                  key={p.id}
                                  className="flex items-start gap-3 rounded-lg border p-3 hover:bg-gray-50 transition-colors"
                                >
                                  <div className="mt-0.5">
                                    {checked ? (
                                      <CheckSquare
                                        size={20}
                                        className="text-blue-600"
                                      />
                                    ) : (
                                      <Square
                                        size={20}
                                        className="text-gray-400"
                                      />
                                    )}
                                    <input
                                      type="checkbox"
                                      className="hidden"
                                      checked={checked}
                                      onChange={(e) =>
                                        togglePermission(p.id, e.target.checked)
                                      }
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <div className="font-medium text-gray-800">
                                      {p.name}
                                    </div>
                                    {p.description ? (
                                      <div className="text-sm text-gray-600 mt-1">
                                        {p.description}
                                      </div>
                                    ) : null}
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ---------- Modal: Create / Edit Role ---------- */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-lg">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                {editingRole ? <Edit size={18} /> : <Plus size={18} />}
                {editingRole ? "Edit Role" : "Create Role"}
              </h3>
              <button
                onClick={() => setShowRoleModal(false)}
                className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitRole} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Role Name
                </label>
                <input
                  value={formRole.name}
                  onChange={(e) =>
                    setFormRole((s) => ({ ...s, name: e.target.value }))
                  }
                  className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="e.g. Administrator"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Description
                </label>
                <textarea
                  value={formRole.description}
                  onChange={(e) =>
                    setFormRole((s) => ({ ...s, description: e.target.value }))
                  }
                  className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-300"
                  rows={3}
                  placeholder="Describe this role's purpose and responsibilities"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg border text-gray-700 hover:bg-gray-50"
                  onClick={() => setShowRoleModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRole}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                >
                  {submittingRole
                    ? "Saving…"
                    : editingRole
                    ? "Save Changes"
                    : "Create Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete.open && confirmDelete.role && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-lg p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <Trash2 size={24} className="text-red-600" />
              </div>
              <h3 className="font-semibold text-lg">Delete Role</h3>
            </div>

            <p className="text-gray-600 mb-5">
              Are you sure you want to delete the role{" "}
              <span className="font-medium">"{confirmDelete.role.name}"</span>?
              This action cannot be undone.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete({ open: false, role: null })}
                className="px-4 py-2 rounded-lg border text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={doDeleteRole}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 flex items-center gap-1"
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
