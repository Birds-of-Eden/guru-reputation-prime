import type { Task } from "@/types/task";
import { generateRandomTime } from "./time-utils";

// Initialize tasks for a tab
export const initializeTabTasks = (links: any[]): Task[] => {
  return links.map((link) => ({
    id: link.id,
    name: link.name ?? "Task",
    link: link.link,
    username: link.username,
    email: link.email,
    password: link.password,
    status: "pending",
    priority: link.priority ?? "medium",
    dueDate: link.dueDate ?? null,
    idealDurationMinutes: link.idealDurationMinutes ?? null,
    timeAllotted: generateRandomTime(),
    timeRemaining: null,
    timerActive: false,
    timerExpired: false,
    extraTimeSpent: 0,
    totalTimeSpent: 0,
  }));
};
