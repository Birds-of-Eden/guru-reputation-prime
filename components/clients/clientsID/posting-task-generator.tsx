"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, differenceInCalendarDays, addDays, isWeekend } from "date-fns";
import { Calendar as CalendarIcon, Rocket, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface PostingTaskGeneratorProps {
  taskId: string;
  taskName?: string;
  assignmentId?: string;
  assetName: string;
  clientId?: string;
  clientName: string;
  defaultFrequency?: number;
  clientDueDate?: Date | null;
  onSuccess?: () => void;
  isClientOverride?: boolean;
}

export function PostingTaskGenerator({
  taskId,
  assetName,
  clientId,
  clientName,
  defaultFrequency = 3,
  clientDueDate,
  onSuccess,
}: PostingTaskGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [frequency, setFrequency] = useState(defaultFrequency);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [dueDate, setDueDate] = useState<Date | null>(clientDueDate || null);
  const [preview, setPreview] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    if (!open) return () => { mounted = false; };

    const run = async () => {
      try {
        if (clientId) {
          const res = await fetch(`/api/clients/${clientId}`);
          const data = await res.json();
          if (!mounted) return;
          const raw = (data && (data.dueDate || data?.client?.dueDate || data?.data?.dueDate)) as string | undefined;
          if (raw) {
            setDueDate(new Date(raw));
          } else {
            const months = Number(data?.package?.totalMonths) || Number(data?.totalMonths) || 0;
            const clientStartRaw = (data?.startDate as string | undefined) || undefined;
            const base = clientStartRaw ? new Date(clientStartRaw) : new Date(startDate);
            const approxEnd = months > 0 ? addDays(base, months * 30) : addDays(base, 30);
            setDueDate(approxEnd);
          }
        } else {
          const r = await fetch(`/api/tasks/${taskId}/trigger-posting`);
          const data = await r.json();
          if (!mounted) return;
          const rawDue = (data?.qcTask?.dueDate as string | undefined) || undefined;
          const freq = Number(data?.preview?.requiredFrequency) || undefined;
          if (rawDue) setDueDate(new Date(rawDue));
          if (freq && freq > 0) setFrequency(freq);
        }
      } catch (_err) {
        // ignore
      } finally {
        if (mounted) generatePreview();
      }
    };

    run();
    return () => { mounted = false; };
  }, [open]);

  const addWorkingDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    let added = 0;
    while (added < days) {
      result.setDate(result.getDate() + 1);
      if (!isWeekend(result)) added++;
    }
    return result;
  };

  console.log("dueDate", dueDate);
  console.log("clientID", clientId);

  const generatePreview = () => {
    const end = dueDate ?? addDays(startDate, 30);

    const totalDays = Math.max(1, differenceInCalendarDays(end, startDate));
    const totalMonths = Math.max(1, Math.ceil(totalDays / 30));
    const maxTasks = Math.max(1, frequency * totalMonths);
    const interval = Math.max(1, Math.floor(totalDays / maxTasks));

    const tasks = [] as Array<{ name: string; dueDate: string }>;
    let nextDate = new Date(startDate);
    let count = 0;
    while (count < maxTasks) {
      if (count > 0) nextDate = addWorkingDays(nextDate, interval);
      // stop if beyond end date
      if (nextDate > end) break;
      tasks.push({
        name: `${assetName} - Posting ${count + 1}`,
        dueDate: format(nextDate, "MMM dd, yyyy"),
      });
      count++;
    }

    setPreview(tasks);
  };

  useEffect(() => {
    if (open) generatePreview();
  }, [frequency, startDate, dueDate, open]);

  const handleGenerate = async () => {
    if (!dueDate) return toast.error("Client due date missing");
    setLoading(true);

    try {
      const res = await fetch(`/api/tasks/${taskId}/trigger-posting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frequency,
          startDate: startDate.toISOString(),
        }),
      });
      const data = await res.json();

      if (res.ok) {
        toast.success(`${data.postingTasks?.length || 0} posting tasks created!`);
        setOpen(false);
        onSuccess?.();
      } else toast.error(data.message || "Failed to generate tasks");
    } catch (err) {
      console.error(err);
      toast.error("Error creating posting tasks");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
        }}
        className="gap-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white"
      >
        <Rocket className="h-4 w-4" />
        Generate Posting Tasks
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-blue-500" />
              Generate Posting Tasks
            </DialogTitle>
            <DialogDescription>
              Automatically create posting tasks for{" "}
              <span className="font-semibold">{assetName}</span> under{" "}
              <span className="font-semibold">{clientName}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Posting Frequency (per month)</Label>
              <Input
                type="number"
                min="1"
                max="20"
                value={frequency}
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value || "1"));
                  setFrequency(Number.isFinite(val) ? val : 1);
                }}
                className="w-32"
              />
            </div>

            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[240px] justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(startDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(d) => d && setStartDate(d)}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {dueDate && (
              <p className="text-sm text-slate-600">
                Client Due Date:{" "}
                <span className="font-semibold">{format(dueDate, "PPP")}</span>
              </p>
            )}

            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Preview ({preview.length} tasks)
              </h4>
              <div className="border rounded-lg p-4 bg-slate-50 max-h-64 overflow-y-auto">
                {preview.map((task, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between border-b py-2"
                  >
                    <span className="text-sm">{task.name}</span>
                    <span className="text-xs text-slate-500">{task.dueDate}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>



          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={loading || !dueDate}
              className="gap-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white"
            >
              {loading ? "Generating..." : "Generate Tasks"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
