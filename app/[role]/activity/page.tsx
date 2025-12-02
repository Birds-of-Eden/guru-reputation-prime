// app/[role]/activity/page.tsx

"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import useSWR, { mutate } from "swr";
import { pusherClient } from "@/lib/pusher/client";
import { Skeleton } from "@/components/ui/skeleton";

type ActionType = "create" | "update" | "delete" | "sign_in" | "sign_out" | "onboarded" | "task_assigned";
type Log = {
  id: string;
  entityType: string;
  entityId: string;
  action: ActionType | string;
  timestamp: string;
  details: any;
  user?: { id: string; name: string | null; email: string | null };
};

type PaginationInfo = {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  limit: number;
};

const TZ = "Asia/Dhaka";

// ⚡ OPTIMIZED: Memoize time formatter
const formatRelative = (dateIso: string) => {
  const dt = new Date(dateIso);
  const diffMs = Date.now() - dt.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  return dt.toLocaleString(undefined, { timeZone: TZ });
};

// ⚡ OPTIMIZED: SWR fetcher
const jsonFetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.error || "Failed to fetch");
  }
  return data;
};

export default function ActivityPage() {
  // filters
  const [search, setSearch] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [actionFilter, setActionFilter] = useState<"all" | ActionType>("all");
  const [currentPage, setCurrentPage] = useState(1);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // ⚡ OPTIMIZED: Memoize API URL for SWR
  const apiUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", currentPage.toString());
    params.set("limit", "20");
    if (debouncedQ) params.set("q", debouncedQ);
    if (actionFilter !== "all") params.set("action", actionFilter);
    return `/api/activity?${params.toString()}`;
  }, [currentPage, debouncedQ, actionFilter]);

  // ⚡ OPTIMIZED: Use SWR for automatic caching and revalidation
  const { data, error, isLoading } = useSWR(apiUrl, jsonFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
  });

  const logs = data?.logs || [];
  const pagination = data?.pagination || null;

  // ⚡ OPTIMIZED: Realtime with SWR mutate
  useEffect(() => {
    const channel = pusherClient.subscribe("activity");
    const onNew = (payload: any) => {
      // Optimistic update with SWR mutate
      mutate(apiUrl, (current: any) => {
        if (!current) return current;
        const newLog = {
          id: payload?.id || `rt_${Date.now()}`,
          entityType: payload?.entityType || "",
          entityId: payload?.entityId || "",
          action: payload?.action || "update",
          timestamp: payload?.timestamp || new Date().toISOString(),
          details: payload?.details ?? null,
        };
        return {
          ...current,
          logs: [newLog, ...(current.logs || [])],
        };
      }, false);
      // Revalidate after a short delay
      setTimeout(() => mutate(apiUrl), 1200);
    };
    channel.bind("activity:new", onNew);
    return () => {
      channel.unbind("activity:new", onNew);
      pusherClient.unsubscribe("activity");
    };
  }, [apiUrl]);

  // ⚡ OPTIMIZED: Memoize page change handler
  const handlePageChange = useCallback((page: number) => {
    if (page >= 1 && page <= (pagination?.totalPages || 1)) {
      setCurrentPage(page);
    }
  }, [pagination?.totalPages]);

  // ⚡ OPTIMIZED: Memoize page numbers calculation
  const getPageNumbers = useCallback((): (number | string)[] => {
    if (!pagination) return [];

    const { currentPage, totalPages } = pagination;
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push("...");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      }
    }

    return pages;
  }, [pagination]);

  // ⚡ OPTIMIZED: Memoize page numbers array
  const pageNumbers = useMemo(() => getPageNumbers(), [getPageNumbers]);

  // ⚡ OPTIMIZED: Memoize action badge color
  const getActionColor = useCallback((action: string) => {
    const a = String(action || "").toLowerCase();
    if (a === "create" || a.includes("assigned")) return "bg-emerald-100 text-emerald-700";
    if (a === "update" || a.includes("status") || a.includes("resume") || a.includes("pause")) return "bg-blue-100 text-blue-700";
    if (a === "delete" || a.includes("cancel")) return "bg-red-100 text-red-700";
    if (a.includes("overdue")) return "bg-orange-100 text-orange-700";
    if (a.startsWith("task_timer")) return "bg-purple-100 text-purple-700";
    if (a === "sign_in") return "bg-green-100 text-green-700";
    if (a === "sign_out") return "bg-red-100 text-red-700";
    if (a === "upgrade_package") return "bg-cyan-100 text-cyan-700";
    if (a === "onboarded") return "bg-emerald-100 text-emerald-700";
    return "bg-gray-100 text-gray-700";
  }, []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">📜 Activity Logs</h1>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="🔍 Search by user, entity, action, details..."
          className="border rounded px-3 py-2 w-full sm:w-1/2"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="border rounded px-3 py-2 w-full sm:w-40"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value as any)}
        >
          <option value="all">All Actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
          <option value="sign_in">Sign In</option>
          <option value="sign_out">Sign Out</option>
          <option value="onboarded">onboarded</option>
          <option value="task_assigned">Task Assigned</option>
        </select>
      </div>

      {pagination && !isLoading && (
        <div className="text-sm text-gray-600">
          Showing {(pagination.currentPage - 1) * pagination.limit + 1} to{" "}
          {Math.min(
            pagination.currentPage * pagination.limit,
            pagination.totalCount
          )}{" "}
          of {pagination.totalCount} logs
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2">
          {error.message || "Failed to load logs"}
        </div>
      )}

      <div className="overflow-x-auto border rounded-lg shadow">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3">User</th>
              <th className="p-3">Entity</th>
              <th className="p-3">Action</th>
              <th className="p-3">Details</th>
              <th className="p-3">Time</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              // Skeleton rows for loading
              Array.from({ length: 10 }).map((_, index) => (
                <tr key={`skeleton-${index}`} className="border-b">
                  <td className="p-3">
                    <Skeleton className="h-4 w-32 mb-2" />
                    <Skeleton className="h-3 w-40" />
                  </td>
                  <td className="p-3">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-3 w-36" />
                  </td>
                  <td className="p-3">
                    <Skeleton className="h-6 w-20 rounded" />
                  </td>
                  <td className="p-3">
                    <Skeleton className="h-20 w-full rounded" />
                  </td>
                  <td className="p-3">
                    <Skeleton className="h-4 w-20" />
                  </td>
                </tr>
              ))
            ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-3 text-center text-gray-500">
                    No matching logs found
                  </td>
                </tr>
              ) : (
                logs.map((log: Log) => (
                  <tr
                    key={log.id}
                    className="border-b hover:bg-gray-50 align-top"
                  >
                    <td className="p-3">
                      {log.user?.name || "Unknown"} <br />
                      <span className="text-xs text-gray-500">
                        {log.user?.email}
                      </span>
                    </td>
                    <td className="p-3">
                      {log.entityType} <br />
                      <span className="text-xs text-gray-500">
                        {log.entityId}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>

                    <td className="p-3 max-w-[380px]">
                      {log.details && typeof log.details === "object" ? (
                        <pre className="text-xs border border-gray-200 rounded w-full max-h-40 overflow-auto p-2 whitespace-pre-wrap break-words">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <div
                        title={new Date(log.timestamp).toLocaleString(
                          undefined,
                          { timeZone: TZ }
                        )}
                      >
                        {formatRelative(log.timestamp)}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && !isLoading && (
        <div className="flex items-center justify-between pt-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={!pagination.hasPrevPage}
              className="px-3 py-2 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            <div className="flex items-center gap-1">
              {pageNumbers.map((page, index) => (
                <button
                  key={index}
                  onClick={() =>
                    typeof page === "number"
                      ? handlePageChange(page)
                      : undefined
                  }
                  disabled={page === "..."}
                  className={`px-3 py-2 text-sm border rounded ${
                    page === currentPage
                      ? "bg-blue-500 text-white border-blue-500"
                      : page === "..."
                      ? "cursor-default border-transparent"
                      : "hover:bg-gray-50"
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={!pagination.hasNextPage}
              className="px-3 py-2 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>

          <div className="text-sm text-gray-600">
            Page {pagination.currentPage} of {pagination.totalPages}
          </div>
        </div>
      )}
    </div>
  );
}
