import type { TemplateStatus, Template, Task } from "@/types/template-type";

export const statusLabels: Record<TemplateStatus, string> = {
  pending: "Pending",
  "in-progress": "In Progress",
  completed: "Completed",
};

export const statusVariants: Record<TemplateStatus, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  "in-progress": "bg-sky-50 text-sky-700 border-sky-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

// Minimal placeholder data generator; replace with real API data if available.
export function generateTemplatesForPackage(_packageId: string): Template[] {
  return [];
}
