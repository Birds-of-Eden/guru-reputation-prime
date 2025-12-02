// app/components/onboarding/review-info.tsx
// @ts-nocheck

"use client";

import { useMemo, useState, FC, ReactNode, useCallback, memo } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Briefcase,
  PlusCircle,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Building,
  BadgeCheck,
  Sparkles,
  Clock,
  BookOpen,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { AssignmentPreview } from "./assignment-preview";
import { Badge } from "@/components/ui/badge";

// --- TYPE DEFINITIONS ---
type AMUser = { id: string; name: string | null; email: string | null };
type SocialLink = { platform: string; url: string };
type OtherField = { category: string; title: string; data: string[] };
type ArticleTopic = { topicname: string };
type ArticleCategory = {
  category: string;
  titles: Array<{
    title: string;
    draftLink: string;
    draftStatus: "Approved" | "Pending" | "Revision";
  }>;
};

interface OnboardingData {
  name: string;
  birthdate?: string;
  company?: string;
  designation?: string;
  location?: string;
  gender?: "male" | "female" | "other";
  email?: string;
  phone?: string;
  password?: string;
  recoveryEmail?: string;
  websites?: string[];
  companywebsite?: string;
  companyaddress?: string;
  biography?: string;
  imageDrivelink?: string;
  avatar?: string | null;
  profilePicture?: File | null;
  progress?: number;
  status?: string;
  packageId?: string;
  templateId?: string;
  startDate?: string;
  dueDate?: string;
  articleTopics?: ArticleTopic[];
  articleCategories?: ArticleCategory[];
  amId?: string;
  socialLinks?: SocialLink[];
  otherField?: OtherField[];
}

interface ReviewInfoProps {
  formData: OnboardingData;
  onPrevious: () => void;
  clearDraft?: () => void;
}

interface InfoItemProps {
  label: string;
  value?: ReactNode;
  icon?: React.ElementType;
}

interface ReviewSectionProps {
  icon: React.ElementType;
  title: string;
  children: ReactNode;
  gradient?: string;
}

// --- COLOR SCHEME CONSTANTS ---
const COLORS = {
  primary: {
    gradient: "from-indigo-600 to-purple-600",
    light: "bg-indigo-50",
    medium: "bg-indigo-100",
    dark: "text-indigo-700",
    border: "border-indigo-200",
  },
  success: {
    gradient: "from-emerald-500 to-teal-600",
    light: "bg-emerald-50",
    dark: "text-emerald-700",
    border: "border-emerald-200",
  },
  warning: {
    light: "bg-amber-50",
    dark: "text-amber-700",
    border: "border-amber-200",
  },
  neutral: {
    light: "bg-slate-50",
    medium: "bg-slate-100",
    dark: "text-slate-700",
    border: "border-slate-200",
  },
} as const;

// --- Helper: detect if text is a link ---
const isLikelyUrl = (v: string) =>
  /^https?:\/\//i.test(v) || /^[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(v);

// --- REUSABLE SUB-COMPONENTS ---

const ReviewSectionCard: FC<ReviewSectionProps> = memo(({
  icon: Icon,
  title,
  children,
  gradient = "from-blue-50 to-indigo-50",
}) => (
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
));

ReviewSectionCard.displayName = "ReviewSectionCard";

const InfoItem: FC<InfoItemProps> = memo(({ label, value, icon: Icon }) => {
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
});

InfoItem.displayName = "InfoItem";

const StatusBadge: FC<{ status?: string; progress?: number }> = memo(({
  status,
  progress,
}) => {
  if (!status) return null;

  const statusConfig = {
    active: {
      color: "bg-emerald-100 text-emerald-800 border-emerald-200",
      icon: BadgeCheck,
    },
    pending: {
      color: "bg-amber-100 text-amber-800 border-amber-200",
      icon: Clock,
    },
    draft: {
      color: "bg-slate-100 text-slate-800 border-slate-200",
      icon: FileText,
    },
    completed: {
      color: "bg-indigo-100 text-indigo-800 border-indigo-200",
      icon: CheckCircle,
    },
  };

  const config =
    statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
  const StatusIcon = config.icon;

  return (
    <Badge
      variant="outline"
      className={`${config.color} px-3 py-1.5 rounded-full font-medium`}
    >
      <StatusIcon className="w-3 h-3 mr-1.5" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
      {progress !== undefined && ` • ${progress}%`}
    </Badge>
  );
});

StatusBadge.displayName = "StatusBadge";

// --- MAIN COMPONENT ---

export function ReviewInfo({ formData, onPrevious, clearDraft }: ReviewInfoProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const router = useRouter();

  // ⚡ OPTIMIZED: Use SWR for parallel fetches with automatic caching
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
        {
          label: "Gender",
          value: formData.gender
            ? formData.gender.charAt(0).toUpperCase() + formData.gender.slice(1)
            : null,
          icon: User,
        },
        { label: "Location", value: formData.location, icon: MapPin },
        { label: "Company", value: formData.company, icon: Building },
        { label: "Designation", value: formData.designation, icon: BadgeCheck },
      ].filter((item) => item.value),
    });

    // Contact & Credentials
    reviewSections.push({
      id: "contact",
      icon: BookUser,
      title: "Contact & Credentials",
      gradient: "from-emerald-50 to-teal-50",
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

    // Websites (dynamic)
    const websiteList = Array.isArray((formData as any).websites)
      ? ((formData as any).websites as string[])
      : [];

    reviewSections.push({
      id: "websites",
      icon: Globe,
      title: "Websites & Addresses",
      gradient: "from-purple-50 to-violet-50",
      items: [
        ...websiteList
          .filter((url) => typeof url === "string" && url.trim() !== "")
          .map((url: string, idx: number) => ({
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

    // Article Topics (old structure - keeping for backward compatibility)
    if (formData.articleTopics && formData.articleTopics.length > 0) {
      reviewSections.push({
        id: "articles",
        icon: FileText,
        title: "Article Topics",
        gradient: "from-purple-50 to-indigo-50",
        items: formData.articleTopics.map(
          (topic: ArticleTopic, index: number) => ({
            label: `Topic ${index + 1}`,
            value: topic.topicname,
            icon: FileText,
          })
        ),
      });
    }

    // Article Categories (new structure)
    if (formData.articleCategories && formData.articleCategories.length > 0) {
      reviewSections.push({
        id: "articleCategories",
        icon: BookOpen,
        title: "Article Categories from CQ",
        gradient: "from-orange-50 to-red-50",
        items: [],
      });
    }

    // Project Details
    reviewSections.push({
      id: "project",
      icon: Briefcase,
      title: "Project Details",
      gradient: "from-orange-50 to-amber-50",
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
        { label: "Account Manager", value: fetchedData.amName, icon: User },
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
      ].filter((item) => item.value),
    });

    return reviewSections.filter((s) => s.items.length > 0);
  }, [formData, fetchedData]);

  const groupedOther = useMemo(() => {
    const raw = formData.otherField || [];
    const map = new Map<string, OtherField[]>();
    for (const it of raw) {
      const cat = (it?.category || "General").trim() || "General";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(it);
    }
    // sort by category A→Z and item title A→Z
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([cat, items]) =>
          [cat, items.sort((x, y) => x.title.localeCompare(y.title))] as const
      );
  }, [formData.otherField]);

  const avatarPreviewUrl = useMemo(() => {
    if (formData.profilePicture instanceof File) {
      return URL.createObjectURL(formData.profilePicture);
    }
    return formData.avatar || null;
  }, [formData.profilePicture, formData.avatar]);

  const handleDownload = () => {
    const dataStr = JSON.stringify(formData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `client-data-${formData.name}-${
      new Date().toISOString().split("T")[0]
    }.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Data downloaded successfully!");
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      const { profilePicture, ...restOfData } = formData;
      const clientRes = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(restOfData),
      });

      const clientResult = await clientRes.json();
      if (!clientRes.ok) {
        toast.error(clientResult.error || "Failed to create client.");
        setIsSaving(false);
        return;
      }
      toast.success("Client created successfully!");

      const createdClientId: string =
        clientResult?.id ?? clientResult?.client?.id ?? clientResult?.data?.id;

      if (formData.templateId && createdClientId) {
        const assignmentRes = await fetch("/api/assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateId: formData.templateId,
            clientId: createdClientId,
            status: "active",
          }),
        });

        if (assignmentRes.ok) {
          toast.success("Template assigned successfully!");
        } else {
          toast.warning("Client created but template assignment failed.");
        }
      }
      
      // Clear draft on successful submission
      if (clearDraft) {
        clearDraft();
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
              onClick={() => router.push("/admin")}
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 shadow-lg mb-4">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 bg-clip-text text-transparent">
          Review & Confirm
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
          {sections.map((section) => (
            <ReviewSectionCard
              key={section.id}
              icon={section.icon}
              title={section.title}
              gradient={section.gradient}
            >
              <div className="space-y-3">
                {section.items.map((item, idx) => (
                  <InfoItem key={idx} {...item} />
                ))}
              </div>
            </ReviewSectionCard>
          ))}
        </div>

        {/* Right Column - Additional Content */}
        <div className="space-y-6">
          {/* Social Links */}
          {formData.socialLinks && formData.socialLinks.length > 0 && (
            <ReviewSectionCard
              icon={Share2}
              title="Social Media Profiles"
              gradient="from-rose-50 to-pink-50"
            >
              <div className="space-y-3">
                {formData.socialLinks.map(
                  (link, index) =>
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
          {groupedOther.length > 0 && (
            <ReviewSectionCard
              icon={PlusCircle}
              title="Additional Information"
              gradient="from-violet-50 to-purple-50"
            >
              <div className="space-y-6">
                {groupedOther.map(([category, items]) => (
                  <div
                    key={category}
                    className="rounded-2xl border border-slate-200 overflow-hidden"
                  >
                    {/* Category header */}
                    <div className="px-4 py-2 bg-slate-50 flex items-center justify-between">
                      <span className="font-semibold text-slate-800">
                        {category}
                      </span>
                      <Badge variant="secondary">
                        {items.reduce((n, it) => n + (it.data?.length || 0), 0)}{" "}
                        items
                      </Badge>
                    </div>

                    {/* Category body */}
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {items.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-4 bg-white rounded-xl border border-slate-200"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-semibold text-slate-800 text-sm">
                              {item.title || "(Untitled)"}
                            </p>
                            <Badge variant="outline">
                              {item.data?.length || 0}
                            </Badge>
                          </div>

                          <ul className="space-y-2">
                            {(item.data || []).map((val, i) => {
                              const v = String(val || "").trim();
                              if (!v) return null;

                              // clickable links
                              if (isLikelyUrl(v)) {
                                const href = /^https?:\/\//i.test(v)
                                  ? v
                                  : `https://${v}`;
                                return (
                                  <li
                                    key={i}
                                    className="flex items-start justify-between gap-2"
                                  >
                                    <a
                                      href={href}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-start gap-2 rounded-lg px-3 py-1.5 border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 break-all w-full"
                                      title={v}
                                    >
                                      <LinkIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                      <span className="break-words">{v}</span>
                                    </a>
                                  </li>
                                );
                              }

                              // plain text
                              return (
                                <li
                                  key={i}
                                  className="text-slate-700 text-sm whitespace-pre-wrap break-words"
                                >
                                  {v}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ReviewSectionCard>
          )}

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

      {/* Article Categories from CQ - Full Width */}
      {formData.articleCategories && formData.articleCategories.length > 0 && (
        <ReviewSectionCard
          icon={BookOpen}
          title="Article Categories from CQ"
          gradient="from-orange-50 to-red-50"
        >
          <div className="space-y-4">
            {formData.articleCategories.map((category, catIdx) => (
              <div
                key={catIdx}
                className="bg-white rounded-xl border-2 border-orange-200 p-5"
              >
                <h3 className="text-lg font-bold text-orange-700 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  {category.category}
                  <Badge variant="secondary" className="ml-2">
                    {category.titles.length} {category.titles.length === 1 ? 'title' : 'titles'}
                  </Badge>
                </h3>
                <div className="space-y-3 ml-6">
                  {category.titles.map((title, titleIdx) => (
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
        </ReviewSectionCard>
      )}

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
            onClick={handleDownload}
            variant="outline"
            className="px-6 py-6 text-base font-semibold border-2 hover:bg-gray-50 transition-all duration-200 rounded-xl"
          >
            <Download className="w-5 h-5 mr-2" />
            Download
          </Button>

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
