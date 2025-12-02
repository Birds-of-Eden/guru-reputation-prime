// components/onboarding/DataEntryReviewInfo.tsx
// @ts-nocheck

"use client";

import { useMemo, useState, memo, useCallback } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import DOMPurify from "dompurify";
import {
  Download,
  CheckCircle,
  ArrowLeft,
  User,
  Globe,
  Package,
  FileText,
  Image as ImageIcon,
  Share2,
  BookUser,
  Link as LinkIcon,
  PlusCircle,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Building,
  BadgeCheck,
  Sparkles,
  Clock,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { AssignmentPreview } from "./assignment-preview";
import { useAuth } from "@/context/auth-context";

type AMUser = { id: string; name: string | null; email: string | null };

export function DataEntryReviewInfo({ formData, onPrevious }: any) {
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  // ⚡ OPTIMIZED: Use SWR for parallel fetches
  const jsonFetcher = async (url: string) => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  };

  // Parallel fetch #1: Package
  const { data: pkgData } = useSWR(
    formData.packageId ? `/api/packages/${formData.packageId}` : null,
    jsonFetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  // Parallel fetch #2: Template
  const { data: tplData } = useSWR(
    formData.templateId ? `/api/packages/templates/${formData.templateId}` : null,
    jsonFetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  // Parallel fetch #3: AM users
  const { data: amsData } = useSWR(
    "/api/users?role=am&limit=100",
    jsonFetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  // ⚡ OPTIMIZED: Memoize fetched data
  const fetchedData = useMemo(() => {
    const amsList: AMUser[] = (amsData?.users ?? amsData?.data ?? [])
      .filter((u: any) => u?.role?.name === "am")
      .map((u: any) => ({
        id: u.id,
        name: u.name ?? null,
        email: u.email ?? null,
      }));

    const foundAm = formData.amId
      ? amsList.find((u) => u.id === formData.amId)
      : null;
    const amName = foundAm
      ? foundAm.name || foundAm.email || foundAm.id
      : formData.amId || "";

    return {
      packageName: pkgData?.name || "",
      templateName: tplData?.name || "",
      amName: amName,
    };
  }, [pkgData, tplData, amsData, formData.amId]);

  // Aggregate websites once for reuse in UI and payload (dynamic, unlimited)
  const websiteList = useMemo(() => {
    return Array.isArray((formData as any)?.websites)
      ? ((formData as any).websites as string[]) || []
      : [];
  }, [formData]);

  const sections = useMemo(() => {
    const reviewSections = [];

    // Personal & Work Info
    reviewSections.push({
      id: "personal",
      icon: User,
      title: "Personal & Work Information",
      gradient: "from-blue-50 to-cyan-50",
      items: [
        { label: "Full Name", value: formData.name, icon: User },
        {
          label: "Birth Date",
          value: formData.birthdate
            ? new Date(formData.birthdate).toLocaleDateString()
            : null,
          icon: Calendar,
        },
        { label: "Gender", value: formData.gender, icon: User },
        { label: "Location", value: formData.location, icon: MapPin },
        { label: "Company", value: formData.company, icon: Building },
        { label: "Designation", value: formData.designation, icon: BadgeCheck },
        { label: "Status", value: formData.status, icon: FileText },
        { label: "Account Manager", value: fetchedData.amName, icon: User },
      ].filter((item) => item.value),
    });

    reviewSections.push({
      id: "websites",
      icon: Globe,
      title: "Website Information",
      gradient: "from-purple-50 to-violet-50",
      items: [
        ...websiteList.map((url: string, idx: number) => ({
          label: websiteList.length > 1 ? `Website ${idx + 1}` : "Website",
          value: url,
          icon: Globe,
        })),
        {
          label: "Company Website",
          value: formData.companywebsite,
          icon: Building,
        },
        {
          label: "Company Address",
          value: formData.companyaddress,
          icon: MapPin,
        },
      ].filter((item) => item.value),
    });

    // Project Details
    reviewSections.push({
      id: "project",
      icon: Package,
      title: "Project Details",
      gradient: "from-green-50 to-emerald-50",
      items: [
        {
          label: "Package",
          value: fetchedData.packageName || formData.packageId,
          icon: Package,
        },
        {
          label: "Template",
          value: fetchedData.templateName || formData.templateId,
          icon: FileText,
        },
        {
          label: "Start Date",
          value: formData.startDate
            ? new Date(formData.startDate).toLocaleDateString()
            : null,
          icon: Calendar,
        },
        {
          label: "Due Date",
          value: formData.dueDate
            ? new Date(formData.dueDate).toLocaleDateString()
            : null,
          icon: Calendar,
        },
        {
          label: "Progress",
          value:
            typeof formData.progress === "number"
              ? `${formData.progress}%`
              : null,
          icon: Clock,
        },
      ].filter((item) => item.value),
    });

    // Article Topics - support both old and new structure
    // Check both articleTopics and articleCategories (they should be same data, just different naming in form flow)
    const articleData = formData.articleTopics || formData.articleCategories;

    // Article Topics / Categories Section
    if (
      formData.articleCategories &&
      Array.isArray(formData.articleCategories) &&
      formData.articleCategories.length > 0
    ) {
      reviewSections.push({
        id: "articleCategories",
        icon: FileText,
        title: "Article Categories from CQ",
        gradient: "from-orange-50 to-red-50",
        items: [],
        render: (
          <div className="space-y-4">
            {formData.articleCategories.map((category: any, catIdx: number) => (
              <div
                key={catIdx}
                className="bg-white rounded-xl border-2 border-orange-200 p-5"
              >
                <h3 className="text-lg font-bold text-orange-700 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  {category.category}
                  <Badge variant="secondary" className="ml-2">
                    {category.titles.length}{" "}
                    {category.titles.length === 1 ? "title" : "titles"}
                  </Badge>
                </h3>
                <div className="space-y-3 ml-6">
                  {category.titles.map((title: any, titleIdx: number) => (
                    <div
                      key={titleIdx}
                      className="bg-orange-50 rounded-lg p-4 border border-orange-200"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900">
                              {title.title}
                            </p>
                          </div>
                          <Badge
                            className={
                              title.draftStatus === "Approved"
                                ? "bg-green-100 text-green-800 border-green-200"
                                : title.draftStatus === "Revision"
                                ? "bg-amber-100 text-amber-800 border-amber-200"
                                : "bg-blue-100 text-blue-800 border-blue-200"
                            }
                          >
                            {title.draftStatus}
                          </Badge>
                        </div>
                        {title.draftLink && (
                          <a
                            href={title.draftLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 hover:underline text-sm"
                          >
                            <LinkIcon className="h-3 w-3" />
                            {title.draftLink}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ),
      });
    }

    // Contact & Credentials
    reviewSections.push({
      id: "contact",
      icon: BookUser,
      title: "Contact & Credentials",
      gradient: "from-amber-50 to-orange-50",
      items: [
        { label: "Email", value: formData.email, icon: Mail },
        { label: "Phone", value: formData.phone, icon: Phone },
        {
          label: "Password",
          value: formData.password ? "••••••••" : null,
          icon: FileText,
        },
        { label: "Recovery Email", value: formData.recoveryEmail, icon: Mail },
      ].filter((item) => item.value),
    });

    // Filter sections: keep if has items OR has custom render
    return reviewSections.filter(
      (s) => (s.items && s.items.length > 0) || s.render
    );
  }, [formData, fetchedData]);

  const avatarPreviewUrl = useMemo(() => {
    if (formData?.profilePicture instanceof File) {
      return URL.createObjectURL(formData.profilePicture);
    }
    return formData.avatar || null;
  }, [formData?.profilePicture, formData.avatar]);

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      const clientData = {
        name: formData.name,
        birthdate: formData.birthdate,
        gender: formData.gender,
        company: formData.company,
        designation: formData.designation,
        location: formData.location,
        email: formData.email || null,
        phone: formData.phone || null,
        password: formData.password || null,
        recoveryEmail: formData.recoveryEmail || null,
        // include aggregated websites array for multi-site support
        websites: websiteList,
        companywebsite: formData.companywebsite,
        companyaddress: formData.companyaddress,
        biography: formData.biography,
        imageDrivelink: formData.imageDrivelink,
        avatar: formData.avatar || null,
        progress: formData.progress,
        status: formData.status,
        packageId: formData.packageId,
        startDate: formData.startDate,
        dueDate: formData.dueDate,
        // Support both articleTopics and articleCategories field names
        articleTopics:
          formData.articleTopics || formData.articleCategories || [],
        amId: formData.amId || null,
        socialLinks: formData.socialLinks || [],
        otherField: (formData.otherField || []).map((r: any) => ({
          title: String(r.title || ""),
          data: String(r.data || ""),
        })),
      };

      // Debug: Log article data being sent
      console.log(
        "Submitting client with articleTopics:",
        clientData.articleTopics
      );
      console.log("formData.articleCategories:", formData.articleCategories);
      console.log("formData.articleTopics:", formData.articleTopics);

      const clientRes = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clientData),
      });

      const clientResult = await clientRes.json();

      if (!clientRes.ok) {
        toast.error(clientResult.error || "Failed to create client.");
        setIsSaving(false);
        return;
      }

      const createdClientId: string =
        clientResult?.id ?? clientResult?.client?.id ?? clientResult?.data?.id;

      toast.success("Client created successfully!");

      if (formData.templateId && createdClientId) {
        try {
          const assignment = {
            clientId: createdClientId,
            templateId: formData.templateId,
            status: "active",
            agentIds: user?.id ? [user.id] : [],
          };

          const assignmentRes = await fetch("/api/assignments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(assignment),
          });

          if (assignmentRes.ok) {
            toast.success(
              `Template "${
                fetchedData.templateName || formData.templateId
              }" assigned successfully!`
            );

            try {
              const createdAssignment = await assignmentRes.json();
              const createdTasks: any[] =
                createdAssignment?.tasks ||
                createdAssignment?.data?.tasks ||
                [];
              if (Array.isArray(createdTasks) && createdTasks.length > 0) {
                // Set due date to the package start date
                const startDateRaw = (formData as any)?.startDate;
                const packageStartISO = startDateRaw
                  ? new Date(startDateRaw).toISOString()
                  : (() => {
                      const fallback = new Date();
                      fallback.setDate(fallback.getDate() + 7);
                      return fallback.toISOString();
                    })();

                const distributeBody = {
                  clientId: createdClientId,
                  assignments: createdTasks.map((t: any) => ({
                    taskId: t.id,
                    agentId: user?.id,
                    note: "Auto-assigned to creator after onboarding",
                    dueDate: packageStartISO,
                  })),
                };

                const distRes = await fetch("/api/tasks/distribute", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(distributeBody),
                });

                if (distRes.ok) {
                  toast.success(
                    `Tasks assigned to ${user?.name} successfully.`
                  );
                } else {
                  const j = await distRes.json().catch(() => ({}));
                  console.error("Distribute failed", j);
                  toast.warning(
                    "Template assigned but auto-assignment to your user failed."
                  );
                }
              }
            } catch (e) {
              console.error("Auto-assign to data_entry failed", e);
            }
          } else {
            toast.warning(
              "Client created but template assignment failed. You can assign it manually later."
            );
          }
        } catch {
          toast.warning(
            "Client created but template assignment failed. You can assign it manually later."
          );
        }
      }

      setIsSubmitted(true);
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred during submission.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4 py-12 font-[Inter] text-slate-800">
        <div className="text-center max-w-md mx-auto space-y-8">
          {/* Minimal Icon Container */}
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 flex items-center justify-center rounded-full border-2 border-green-500 bg-green-50">
              <CheckCircle className="h-16 w-16 text-green-600" />
            </div>
          </div>

          <div className="space-y-3">
            {/* Simplified Title */}
            <h2 className="text-4xl font-bold tracking-tight text-slate-900">
              Submission Successful!
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed">
              Thank you for completing the onboarding process. Your client
              information has been saved successfully.
            </p>
          </div>

          {/* Minimal Button */}
          <div className="pt-4">
            <button
              onClick={() => router.push("/data_entry")}
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-colors duration-300 shadow-md"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const ReviewSectionCard = ({
    icon: Icon,
    title,
    children,
    gradient = "from-blue-50 to-indigo-50",
  }: any) => (
    <Card className="overflow-hidden border-2 border-indigo-100 shadow-xl bg-gradient-to-br from-white to-indigo-50/30 rounded-2xl hover:shadow-2xl transition-all duration-300">
      <CardHeader className="relative space-y-0 py-6 px-8 border-b-0">
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Icon className="w-5 h-5 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            {title}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-8 relative">{children}</CardContent>
    </Card>
  );

  const InfoItem = ({ label, value, icon: Icon }: any) => {
    if (!value) return null;

    return (
      <div className="group flex items-start gap-3 p-4 rounded-xl bg-white border-2 border-gray-200 hover:border-indigo-300 hover:shadow-lg transition-all duration-200">
        {Icon && (
          <div className="p-2 bg-indigo-100 rounded-lg group-hover:bg-indigo-200 transition-colors">
            <Icon className="w-4 h-4 text-indigo-600" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">
            {label}
          </span>
          <span className="text-gray-900 font-medium text-base leading-relaxed break-words">
            {value}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 shadow-lg mb-4">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 bg-clip-text text-transparent">
          Review Client Information
        </h1>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto leading-relaxed">
          Please review all the information below carefully. This will be used
          to create the client profile and assign the template.
        </p>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Form Sections */}
        <div className="space-y-6">
          {sections.map((section: any) => (
            <ReviewSectionCard
              key={section.id}
              icon={section.icon}
              title={section.title}
              gradient={section.gradient}
            >
              {section.render ? (
                section.render
              ) : (
                <div className="space-y-3">
                  {section.items.map((item: any, idx: number) => (
                    <InfoItem key={idx} {...item} />
                  ))}
                </div>
              )}
            </ReviewSectionCard>
          ))}
        </div>

        {/* Right Column - Additional Content */}
        <div className="space-y-6">
          {/* Biography */}
          {formData.biography && (
            <ReviewSectionCard
              icon={FileText}
              title="Biography"
              gradient="from-cyan-50 to-blue-50"
            >
              <div
                className="text-slate-700 leading-relaxed text-base bg-white p-4 rounded-xl border border-slate-200 prose max-w-none"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(formData.biography, {
                    USE_PROFILES: { html: true },
                  }),
                }}
              />
            </ReviewSectionCard>
          )}

          {/* Social Links */}
          {formData.socialLinks && formData.socialLinks.length > 0 && (
            <ReviewSectionCard
              icon={Share2}
              title="Social Media Profiles"
              gradient="from-rose-50 to-pink-50"
            >
              <div className="space-y-3">
                {formData.socialLinks.map(
                  (link: any, index: number) =>
                    link.url && (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 hover:shadow-md transition-shadow"
                      >
                        <Badge
                          variant="secondary"
                          className="font-medium bg-slate-100 text-slate-700 border-slate-200 px-3 py-1.5"
                        >
                          {link.platform}
                        </Badge>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-800 hover:underline truncate flex-1 text-sm font-medium"
                        >
                          {link.url.replace(/^https?:\/\//, "")}
                        </a>
                      </div>
                    )
                )}
              </div>
            </ReviewSectionCard>
          )}

          {/* Additional Information */}
          {formData.otherField && formData.otherField.length > 0 && (
            <ReviewSectionCard
              icon={PlusCircle}
              title="Additional Information"
              gradient="from-violet-50 to-purple-50"
            >
              <div className="space-y-3">
                {formData.otherField.map((item: any, index: number) => (
                  <div
                    key={index}
                    className="p-4 bg-white rounded-xl border border-slate-200 hover:shadow-md transition-shadow"
                  >
                    <p className="font-semibold text-slate-800 text-sm mb-2">
                      {item.title}
                    </p>
                    <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                      {item.data}
                    </p>
                  </div>
                ))}
              </div>
            </ReviewSectionCard>
          )}

          {/* Assets & Images */}
          {(avatarPreviewUrl || formData.imageDrivelink) && (
            <ReviewSectionCard
              icon={ImageIcon}
              title="Image Drive Link"
              gradient="from-amber-50 to-orange-50"
            >
              <div className="space-y-4">
                {avatarPreviewUrl && (
                  <div className="text-center">
                    <h4 className="text-sm font-medium text-slate-600 mb-3">
                      Profile Picture
                    </h4>
                    <div className="inline-flex p-2 bg-white rounded-2xl shadow-sm border border-slate-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={avatarPreviewUrl}
                        alt="Profile preview"
                        className="h-20 w-20 rounded-xl object-cover shadow-md"
                      />
                    </div>
                  </div>
                )}
                {formData.imageDrivelink && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-600 mb-2">
                      Image Gallery
                    </h4>
                    <a
                      href={formData.imageDrivelink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 hover:underline font-medium bg-white p-3 rounded-xl border border-slate-200 w-full"
                    >
                      <LinkIcon className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate text-sm">
                        {formData.imageDrivelink}
                      </span>
                    </a>
                  </div>
                )}
              </div>
            </ReviewSectionCard>
          )}
        </div>
      </div>
      {/* Assignment Preview */}
      {formData.templateId && (
        <ReviewSectionCard
          icon={Package}
          title="Template Assignment Preview"
          gradient="from-indigo-50 to-blue-50"
        >
          <AssignmentPreview
            templateId={formData.templateId}
            packageId={formData.packageId || ""}
            templateName={fetchedData.templateName}
          />
        </ReviewSectionCard>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-8">
        <Button
          variant="outline"
          onClick={onPrevious}
          className="px-8 py-6 text-lg font-semibold border-2 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 hover:text-indigo-700 hover:border-indigo-400 transition-all duration-200 rounded-xl"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Previous
        </Button>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-8 py-6 text-lg font-semibold bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 hover:from-indigo-700 hover:via-purple-700 hover:to-violet-700 text-white shadow-xl hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transform hover:scale-105 transition-all duration-200"
          >
            {isSaving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Creating Client...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                Confirm & Create Client
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
