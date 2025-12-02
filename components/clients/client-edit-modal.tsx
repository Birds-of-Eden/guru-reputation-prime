// components/clients/client-edit-modal.tsx
"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useUserSession } from "@/lib/hooks/use-user-session";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  User,
  Mail,
  Phone,
  Lock,
  Globe,
  Building,
  MapPin,
  BookOpen,
  Image,
  Package,
  Clock,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

import type { Client } from "@/types/client";

type ClientWithSocial = Client & {
  email?: string | null;
  phone?: string | null;
  password?: string | null;
  recoveryEmail?: string | null;
  amId?: string | null;
};

export type FormValues = {
  name: string;
  birthdate?: string;
  company?: string;
  designation?: string;
  location?: string;
  gender?: string;

  // contact/credentials
  email?: string | null;
  phone?: string | null;
  password?: string | null;
  recoveryEmail?: string | null;

  // websites & media
  websites?: string[];
  companywebsite?: string;
  companyaddress?: string;
  biography?: string;
  imageDrivelink?: string;
  avatar?: string;

  progress?: number;
  status?: string;
  packageId?: string;
  startDate?: string;
  dueDate?: string;

  // AM
  amId?: string | null;
  // Arbitrary JSON pairs to save in Client.otherField
  // Arbitrary JSON (category + title + multiple items) -> Client.otherField (Json)
  otherField?: Array<{ category: string; title: string; data: string[] }>;
};

type AMUser = { id: string; name: string | null; email: string | null };
type PackageOption = { id: string; name: string };

export interface ClientEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientData: ClientWithSocial;
  currentUserRole?: string;
  /** Called after a successful save */
  onSaved?: () => void;
}

function toDateInput(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ClientEditModal({
  open,
  onOpenChange,
  clientData,
  currentUserRole,
  onSaved,
}: ClientEditModalProps) {
  const router = useRouter();
  const { user } = useUserSession();

  const roleName = (
    currentUserRole ??
    (user as any)?.role?.name ??
    (user as any)?.role ??
    ""
  )
    .toString()
    .toLowerCase();
  const isAgent = roleName === "agent";

  // loading & options
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);

  const [ams, setAms] = useState<AMUser[]>([]);
  const [amsLoading, setAmsLoading] = useState(false);
  const [amsError, setAmsError] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);

  const { register, handleSubmit, reset, setValue, watch } =
    useForm<FormValues>({
      defaultValues: {
        name: clientData.name ?? "",
        birthdate: toDateInput(clientData.birthdate as any),
        company: clientData.company ?? "",
        designation: clientData.designation ?? "",
        location: clientData.location ?? "",
        gender: (clientData as any).gender ?? "",
        email: clientData.email ?? "",
        phone: clientData.phone ?? "",
        password: clientData.password ?? "",
        recoveryEmail: clientData.recoveryEmail ?? "",
        websites: Array.isArray((clientData as any).websites)
          ? ((clientData as any).websites as string[]).filter(
              (w) => typeof w === "string" && w.trim() !== ""
            )
          : [],
        companywebsite: clientData.companywebsite ?? "",
        companyaddress: clientData.companyaddress ?? "",
        biography: (clientData as any).biography ?? "",
        imageDrivelink: (clientData as any).imageDrivelink ?? "",
        avatar: (clientData as any).avatar ?? "",
        progress: clientData.progress ?? 0,
        status: (clientData.status as string) ?? "inactive",
        packageId: (clientData.packageId as string) ?? "",
        startDate: toDateInput(clientData.startDate as any),
        dueDate: toDateInput(clientData.dueDate as any),
        amId: clientData.amId ?? null,
      },
    });

  // Watch form values
  const statusValue = watch("status");
  const genderValue = watch("gender");

  // rehydrate form whenever the modal is opened (so stale edits don't linger)
  useEffect(() => {
    if (!open) return;
    reset({
      name: clientData.name ?? "",
      birthdate: toDateInput(clientData.birthdate as any),
      company: clientData.company ?? "",
      designation: clientData.designation ?? "",
      location: clientData.location ?? "",
      gender: (clientData as any).gender ?? "",
      email: clientData.email ?? "",
      phone: clientData.phone ?? "",
      password: clientData.password ?? "",
      recoveryEmail: clientData.recoveryEmail ?? "",
      websites: Array.isArray((clientData as any).websites)
        ? ((clientData as any).websites as string[]).filter(
            (w) => typeof w === "string" && w.trim() !== ""
          )
        : [],
      companywebsite: clientData.companywebsite ?? "",
      companyaddress: clientData.companyaddress ?? "",
      biography: (clientData as any).biography ?? "",
      imageDrivelink: (clientData as any).imageDrivelink ?? "",
      avatar: (clientData as any).avatar ?? "",
      progress: clientData.progress ?? 0,
      status: (clientData.status as string) ?? "inactive",
      packageId: (clientData.packageId as string) ?? "",
      startDate: toDateInput(clientData.startDate as any),
      dueDate: toDateInput(clientData.dueDate as any),
      amId: clientData.amId ?? null,
    });
  }, [open]);

  // ---- otherField (arbitrary JSON key/value pairs) ----
  // ---- otherField (category + title + data[]) ----
  type KV = { category: string; title: string; data: string[] };

  const normalizeOtherField = (raw: any): KV[] => {
    if (!raw) return [];
    // New shape: [{ category, title, data: [] }]
    if (
      Array.isArray(raw) &&
      raw.some((x) => typeof x?.category === "string")
    ) {
      return raw
        .map((it) => ({
          category: String(it?.category ?? "").trim(),
          title: String(it?.title ?? "").trim(),
          data: Array.isArray(it?.data)
            ? it.data.map((d: any) => String(d ?? "").trim()).filter(Boolean)
            : [String(it?.data ?? "").trim()].filter(Boolean),
        }))
        .filter((r) => r.title || r.data.length);
    }
    // Legacy array: [{ title, data }]
    if (Array.isArray(raw)) {
      return raw
        .map((it) => ({
          category: "General",
          title: String((it && (it.title ?? it.key ?? it.name)) ?? "").trim(),
          data: Array.isArray(it?.data)
            ? it.data.map((d: any) => String(d ?? "").trim()).filter(Boolean)
            : [
                String(
                  (it && (it.data ?? it.value ?? it.content)) ?? ""
                ).trim(),
              ].filter(Boolean),
        }))
        .filter((r) => r.title || r.data.length);
    }
    // Object map fallback: { key: value }
    if (typeof raw === "object") {
      return Object.entries(raw).map(([k, v]) => ({
        category: "General",
        title: String(k).trim(),
        data: Array.isArray(v)
          ? (v as any[]).map((d) => String(d ?? "").trim()).filter(Boolean)
          : [String(v ?? "").trim()].filter(Boolean),
      }));
    }
    return [];
  };

  const [otherPairs, setOtherPairs] = useState<KV[]>(
    normalizeOtherField((clientData as any).otherField)
  );

  useEffect(() => {
    if (open)
      setOtherPairs(normalizeOtherField((clientData as any).otherField));
  }, [open]);

  // helpers for array item ops
  const addRow = () =>
    setOtherPairs((prev) => [...prev, { category: "", title: "", data: [""] }]);

  const removeRow = (idx: number) =>
    setOtherPairs((prev) => prev.filter((_, i) => i !== idx));

  const updateRowField = (idx: number, key: keyof KV, value: string) =>
    setOtherPairs((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r))
    );

  const addDataItem = (idx: number) =>
    setOtherPairs((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, data: [...r.data, ""] } : r))
    );

  const updateDataItem = (rowIdx: number, dataIdx: number, value: string) =>
    setOtherPairs((prev) =>
      prev.map((r, i) =>
        i === rowIdx
          ? { ...r, data: r.data.map((d, di) => (di === dataIdx ? value : d)) }
          : r
      )
    );

  const removeDataItem = (rowIdx: number, dataIdx: number) =>
    setOtherPairs((prev) =>
      prev.map((r, i) =>
        i === rowIdx
          ? { ...r, data: r.data.filter((_, di) => di !== dataIdx) }
          : r
      )
    );

  const fetchPackages = async () => {
    try {
      setPackagesLoading(true);
      const res = await fetch("/api/packages", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load packages: ${res.status}`);
      const data = await res.json().catch(() => []);
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.packages)
        ? data.packages
        : [];
      const options: PackageOption[] = list
        .map((p: any) => ({
          id: String(p.id ?? ""),
          name: String(p.name ?? "Unnamed"),
        }))
        .filter((p: PackageOption) => p.id);
      setPackages(options);
    } catch (e) {
      console.error(e);
      setPackages([]);
    } finally {
      setPackagesLoading(false);
    }
  };

  const fetchAMs = async () => {
    try {
      setAmsLoading(true);
      setAmsError(null);
      const res = await fetch("/api/users?role=am&limit=100", {
        cache: "no-store",
      });
      const json = await res.json();
      const raw = (json?.users ?? json?.data ?? []) as any[];
      const list = raw
        .filter((u) => u?.role?.name === "am")
        .map((u) => ({
          id: String(u.id),
          name: u.name ?? null,
          email: u.email ?? null,
        }));
      setAms(list);
    } catch (e) {
      console.error(e);
      setAms([]);
      setAmsError("Failed to load AMs");
    } finally {
      setAmsLoading(false);
    }
  };

  // Load packages & AMs when the modal opens (non-agents only, per your original logic)
  useEffect(() => {
    if (open && !isAgent) {
      fetchPackages();
      fetchAMs();
    }
     
  }, [open, isAgent]);

  const onSubmit = async (values: FormValues) => {
    try {
      setIsSaving(true);

      let payload: Partial<FormValues>;

      if (isAgent) {
        const allowed: (keyof FormValues)[] = [
          "email",
          "phone",
          "password",
          "recoveryEmail",
          "imageDrivelink",
        ];
        payload = allowed.reduce((acc, key) => {
          const val = (values as any)[key];
          if (val !== undefined) (acc as any)[key] = val;
          return acc;
        }, {} as Partial<FormValues>);
      } else {
        const {
          email,
          phone,
          password,
          recoveryEmail,
          imageDrivelink,
          ...rest
        } = values;
        const cleanedPairs = otherPairs
          .map((p) => ({
            category: p.category.trim(),
            title: p.title.trim(),
            data: p.data.map((d) => d.trim()).filter(Boolean),
          }))
          .filter((p) => p.title || p.data.length);

        const webArray = (rest as any).websites as string[] | undefined;
        const cleanedWebsites = (webArray ?? [])
          .map((w) => (w || "").trim())
          .filter((w) => w !== "");
        payload = {
          ...rest,
          websites: cleanedWebsites,
          progress:
            values.progress === undefined || values.progress === null
              ? undefined
              : Number(values.progress),
          birthdate: values.birthdate || undefined,
          startDate: values.startDate || undefined,
          dueDate: values.dueDate || undefined,
          amId: values.amId && values.amId.trim() !== "" ? values.amId : null,
          // attach arbitrary JSON
          otherField: cleanedPairs,
        };
      }

      const res = await fetch(`/api/clients/${clientData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || `Failed with ${res.status}`);
      }

      toast.success("Client updated");
      onOpenChange(false);
      onSaved?.();
      router.refresh();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to update client");
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "in_progress":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "pending":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "paused":
        return "bg-violet-100 text-violet-700 border-violet-200";
      case "inactive":
        return "bg-slate-100 text-slate-700 border-slate-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl border-0 shadow-xl">
        <DialogHeader className="bg-gradient-to-r from-blue-50/70 to-indigo-50/70 py-4 px-6 rounded-t-2xl border-b border-slate-200/70">
          <DialogTitle className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            <User className="h-5 w-5 text-blue-600" />
            Edit Client Profile
          </DialogTitle>
        </DialogHeader>

        <form
          id="edit-client-form"
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-6 p-6"
        >
          {isAgent ? (
            <>
              {/* AGENT-ONLY: Contact & Credentials */}
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-gradient-to-br from-white to-blue-50/60">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Mail className="h-5 w-5 text-blue-600" />
                    Contact & Credentials
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label
                        htmlFor="email"
                        className="text-sm font-medium text-slate-700 mb-2 block"
                      >
                        Email
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        className="border-slate-300 focus:border-blue-500"
                        {...register("email")}
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="phone"
                        className="text-sm font-medium text-slate-700 mb-2 block"
                      >
                        Phone
                      </Label>
                      <Input
                        id="phone"
                        className="border-slate-300 focus:border-blue-500"
                        {...register("phone")}
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="password"
                        className="text-sm font-medium text-slate-700 mb-2 block"
                      >
                        Password
                      </Label>
                      <Input
                        id="password"
                        type="text"
                        className="border-slate-300 focus:border-blue-500"
                        {...register("password")}
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="recoveryEmail"
                        className="text-sm font-medium text-slate-700 mb-2 block"
                      >
                        Recovery Email
                      </Label>
                      <Input
                        id="recoveryEmail"
                        type="email"
                        className="border-slate-300 focus:border-blue-500"
                        {...register("recoveryEmail")}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* AGENT-ONLY: Media (Image Drive Link only) */}
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-gradient-to-br from-white to-purple-50/60">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Image className="h-5 w-5 text-purple-600" aria-label="media" />
                    Media
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <Label
                        htmlFor="imageDrivelink"
                        className="text-sm font-medium text-slate-700 mb-2 block"
                      >
                        Image Drive Link
                      </Label>
                      <Input
                        id="imageDrivelink"
                        className="border-slate-300 focus:border-purple-500"
                        {...register("imageDrivelink")}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              {/* FULL FORM for non-agents — Basic */}
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-gradient-to-br from-white to-blue-50/60">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <User className="h-5 w-5 text-blue-600" />
                    Basic Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label
                        htmlFor="name"
                        className="text-sm font-medium text-slate-700 mb-2 block"
                      >
                        Full Name
                      </Label>
                      <Input
                        id="name"
                        className="border-slate-300 focus:border-blue-500"
                        {...register("name", { required: true })}
                      />
                    </div>
                    <div className="flex gap-2">
                      <div>
                        <Label
                          htmlFor="status"
                          className="text-sm font-medium text-slate-700 mb-2 block"
                        >
                          Status
                        </Label>
                        <Select
                          value={statusValue}
                          onValueChange={(value) => setValue("status", value)}
                        >
                          <SelectTrigger className="border-slate-300 focus:border-blue-500">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="in_progress">
                              In Progress
                            </SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="paused">Paused</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="mt-6">
                        {statusValue && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "mt-2 font-medium",
                              getStatusColor(statusValue)
                            )}
                          >
                            {statusValue.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label
                        htmlFor="birthdate"
                        className="text-sm font-medium text-slate-700 mb-2 block"
                      >
                        Birth Date
                      </Label>
                      <Input
                        id="birthdate"
                        type="date"
                        className="border-slate-300 focus:border-blue-500"
                        {...register("birthdate")}
                      />
                    </div>

                    <div>
                      <Label
                        htmlFor="gender"
                        className="text-sm font-medium text-slate-700 mb-2 block"
                      >
                        Gender
                      </Label>
                      <Select
                        value={genderValue}
                        onValueChange={(value) => setValue("gender", value)}
                      >
                        <SelectTrigger className="border-slate-300 focus:border-blue-500">
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label
                        htmlFor="location"
                        className="text-sm font-medium text-slate-700 mb-2 block"
                      >
                        Location
                      </Label>
                      <Input
                        id="location"
                        className="border-slate-300 focus:border-blue-500"
                        {...register("location")}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Professional */}
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-gradient-to-br from-white to-emerald-50/60">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Building className="h-5 w-5 text-emerald-600" />
                    Professional Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label
                        htmlFor="company"
                        className="text-sm font-medium text-slate-700 mb-2 block"
                      >
                        Company
                      </Label>
                      <Input
                        id="company"
                        className="border-slate-300 focus:border-emerald-500"
                        {...register("company")}
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="designation"
                        className="text-sm font-medium text-slate-700 mb-2 block"
                      >
                        Designation
                      </Label>
                      <Input
                        id="designation"
                        className="border-slate-300 focus:border-emerald-500"
                        {...register("designation")}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label
                        htmlFor="companyaddress"
                        className="text-sm font-medium text-slate-700 mb-2 block"
                      >
                        Company Address
                      </Label>
                      <Input
                        id="companyaddress"
                        className="border-slate-300 focus:border-emerald-500"
                        {...register("companyaddress")}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Account Manager */}
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-gradient-to-br from-white to-amber-50/60">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <User className="h-5 w-5 text-amber-600" />
                    Account Manager
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <Label
                        htmlFor="amId"
                        className="text-sm font-medium text-slate-700 mb-2 block"
                      >
                        Assign AM
                      </Label>
                      <Select
                        disabled={amsLoading || roleName !== "admin"}
                        onValueChange={(value) => setValue("amId", value)}
                        value={watch("amId") || undefined}
                      >
                        <SelectTrigger className="border-slate-300 focus:border-amber-500">
                          <SelectValue
                            placeholder={
                              amsLoading ? "Loading AMs..." : "— None —"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {ams.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name} ({u.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {amsError && (
                        <p className="text-sm text-red-600 mt-1">{amsError}</p>
                      )}
                      {roleName !== "admin" && (
                        <p className="text-sm text-slate-500 mt-1">
                          Only administrators can modify the Account Manager
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Websites */}
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-gradient-to-br from-white to-violet-50/60">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Globe className="h-5 w-5 text-violet-600" />
                    Websites
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2 space-y-3">
                      <Label className="text-sm font-medium text-slate-700 mb-1 block">
                        Websites
                      </Label>
                      {(watch("websites") ?? []).map((_, idx) => (
                        <div key={idx} className="flex gap-2">
                          <Input
                            className="border-slate-300 focus:border-violet-500"
                            {...register(`websites.${idx}` as const)}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="border-slate-300 bg-red-500 text-white hover:bg-red-600 hover:text-white hover:border-red-600"
                            onClick={() => {
                              const current = (watch("websites") ??
                                []) as string[];
                              const next = current.filter((_, i) => i !== idx);
                              setValue("websites", next, { shouldDirty: true });
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        className="border-slate-300 bg-gradient-to-br from-[#3FB28C] to-[#3FB28C]/60 text-white hover:bg-[#3FB28C] hover:text-white hover:border-[#3FB28C]"
                        onClick={() => {
                          const current = (watch("websites") ?? []) as string[];
                          setValue("websites", [...current, ""], {
                            shouldDirty: true,
                          });
                        }}
                      >
                        + Add Website
                      </Button>
                    </div>
                    <div>
                      <Label
                        htmlFor="companywebsite"
                        className="text-sm font-medium text-slate-700 mb-2 block"
                      >
                        Company Website
                      </Label>
                      <Input
                        id="companywebsite"
                        className="border-slate-300 focus:border-violet-500"
                        {...register("companywebsite")}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Media / Bio */}
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-gradient-to-br from-white to-rose-50/60">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-rose-600" />
                    Media & Bio
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label
                        htmlFor="avatar"
                        className="text-sm font-medium text-slate-700 mb-2 block"
                      >
                        Avatar URL
                      </Label>
                      <Input
                        id="avatar"
                        className="border-slate-300 focus:border-rose-500"
                        {...register("avatar")}
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="imageDrivelink"
                        className="text-sm font-medium text-slate-700 mb-2 block"
                      >
                        Drive Link
                      </Label>
                      <Input
                        id="imageDrivelink"
                        className="border-slate-300 focus:border-rose-500"
                        {...register("imageDrivelink")}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label
                        htmlFor="biography"
                        className="text-sm font-medium text-slate-700 mb-2 block"
                      >
                        Biography
                      </Label>
                      <Textarea
                        id="biography"
                        rows={4}
                        className="border-slate-300 focus:border-rose-500"
                        {...register("biography")}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Package & Dates */}
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-gradient-to-br from-white to-cyan-50/60">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Package className="h-5 w-5 text-cyan-600" />
                    Package & Dates
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label
                        htmlFor="packageId"
                        className="text-sm font-medium text-slate-700 mb-2 block"
                      >
                        Package
                      </Label>
                      <Select
                        disabled={packagesLoading}
                        onValueChange={(value) => setValue("packageId", value)}
                        value={watch("packageId") || undefined}
                      >
                        <SelectTrigger className="border-slate-300 focus:border-cyan-500">
                          <SelectValue
                            placeholder={
                              packagesLoading
                                ? "Loading packages..."
                                : "Select a package"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {packages.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label
                        htmlFor="startDate"
                        className="text-sm font-medium text-slate-700 mb-2 block"
                      >
                        Start Date
                      </Label>
                      <Input
                        id="startDate"
                        type="date"
                        className="border-slate-300 focus:border-cyan-500"
                        {...register("startDate")}
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="dueDate"
                        className="text-sm font-medium text-slate-700 mb-2 block"
                      >
                        Due Date
                      </Label>
                      <Input
                        id="dueDate"
                        type="date"
                        className="border-slate-300 focus:border-cyan-500"
                        {...register("dueDate")}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Other (Category + Title + Data[]) */}
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-gradient-to-br from-white to-slate-50/60">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-slate-600" />
                    Other Information
                  </h3>

                  <div className="space-y-4">
                    {otherPairs.map((row, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-slate-200 p-4 bg-white"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                          {/* Category */}
                          <div className="md:col-span-3">
                            <Label className="text-sm font-medium text-slate-700 mb-1 block">
                              Category
                            </Label>
                            <Textarea
                              value={row.category}
                              onChange={(e) =>
                                updateRowField(idx, "category", e.target.value)
                              }
                              rows={1}
                              className="border-slate-300"
                              placeholder="e.g., Publications"
                            />
                          </div>

                          {/* Title */}
                          <div className="md:col-span-3">
                            <Label className="text-sm font-medium text-slate-700 mb-1 block">
                              Title
                            </Label>
                            <Textarea
                              value={row.title}
                              onChange={(e) =>
                                updateRowField(idx, "title", e.target.value)
                              }
                              rows={1}
                              className="border-slate-300"
                              placeholder="e.g., Additional Resources"
                            />
                          </div>

                          {/* Data items */}
                          <div className="md:col-span-5">
                            <Label className="text-sm font-medium text-slate-700 mb-1 block">
                              Data Items
                            </Label>
                            <div className="space-y-2">
                              {row.data.map((d, di) => (
                                <div key={di} className="flex gap-2">
                                  <Textarea
                                    value={d}
                                    onChange={(e) =>
                                      updateDataItem(idx, di, e.target.value)
                                    }
                                    rows={1}
                                    className="border-slate-300 flex-1"
                                    placeholder="Enter link or text"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="border-slate-300 bg-red-500 text-white hover:bg-red-600 hover:text-white hover:border-red-600"
                                    onClick={() => removeDataItem(idx, di)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Remove
                                  </Button>
                                </div>
                              ))}
                              <Button
                                type="button"
                                variant="outline"
                                className="border-slate-300 bg-emerald-500 text-white hover:bg-emerald-600 hover:text-white hover:border-emerald-600"
                                onClick={() => addDataItem(idx)}
                              >
                                + Add Data Item
                              </Button>
                            </div>
                          </div>

                          {/* Remove row */}
                          <div className="md:col-span-1 flex items-end">
                            <Button
                              type="button"
                              variant="outline"
                              className="border-slate-300 bg-red-500 text-white hover:bg-red-600 hover:text-white hover:border-red-600 w-full"
                              onClick={() => removeRow(idx)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}

                    <Button
                      type="button"
                      variant="outline"
                      className="border-slate-300 bg-gradient-to-br from-[#3FB28C] to-[#3FB28C]/60 text-white hover:bg-[#3FB28C] hover:text-white hover:border-[#3FB28C]"
                      onClick={addRow}
                    >
                      + Add Row
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </form>

        <DialogFooter className="px-6 py-4 bg-gradient-to-r from-slate-50/70 to-blue-50/70 border-t border-slate-200/70 rounded-b-2xl">
          <Button
            variant="outline"
            className="border-slate-300 text-slate-700 hover:bg-slate-100"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            form="edit-client-form"
            type="submit"
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700"
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
