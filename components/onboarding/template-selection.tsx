// components/onboarding/template-selection.tsx
// @ts-nocheck

"use client";
// @ts-nocheck

import { useState, useMemo } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle,
  Sparkles,
  FileText,
  Layers,
  TrendingUp,
  Star,
  Users,
  Eye,
} from "lucide-react";
import type { StepProps } from "@/types/onboarding";
import { toast } from "sonner";
import { TemplateViewModal } from "@/components/package/Template-View-Modal";

interface Template {
  id: string;
  name: string;
  description: string;
  status: string;
  packageId: string;
  sitesAssets?: any[];
  templateTeamMembers?: any[];
  _count?: {
    sitesAssets: number;
    templateTeamMembers: number;
  };
}

export function TemplateSelection({
  formData,
  updateFormData,
  onNext,
  onPrevious,
}: StepProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>(
    formData.templateId || ""
  );
  const [viewingTemplate, setViewingTemplate] = useState<Template | null>(null);

  // ⚡ OPTIMIZED: Use SWR for automatic caching
  const jsonFetcher = async (url: string) => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
  };

  const swrKey = useMemo(() => {
    if (!formData.packageId) return null;
    return `/api/zisanpackages/${formData.packageId}/templates?include=full`;
  }, [formData.packageId]);

  const { data: templates = [], isLoading: loading, error } = useSWR<Template[]>(
    swrKey,
    jsonFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      onSuccess: (data) => {
        if (data.length === 0) {
          toast.info("No templates found for this package");
        }
      },
      onError: (err) => {
        console.error("Error fetching templates:", err);
        toast.error("Something went wrong while fetching templates");
      },
    }
  );

  // Show error if no package selected
  if (!formData.packageId && !loading) {
    toast.error("Please select a package first");
  }

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    updateFormData({ templateId });
    toast.success("Template selected successfully!");
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-800 border-green-200";
      case "draft":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "archived":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-blue-100 text-blue-800 border-blue-200";
    }
  };

  if (loading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg mb-4 animate-pulse">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent">
            Select Template
          </h1>
          <p className="text-gray-600 text-lg">
            Loading available templates for your package...
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="relative overflow-hidden">
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg mb-4">
          <FileText className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent">
          Select Your Template
        </h1>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto">
          Choose a template that perfectly aligns with your project requirements
          and business goals.
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto w-32 h-32 bg-gradient-to-br from-purple-100 via-fuchsia-100 to-pink-100 rounded-3xl flex items-center justify-center mb-6 shadow-xl">
            <FileText className="w-16 h-16 text-purple-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">
            No Templates Available
          </h3>
          <p className="text-gray-600 text-lg max-w-md mx-auto">
            There are no templates available for the selected package. Please
            contact support or try a different package.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {templates.map((template, index) => {
            const isCustomized = template.description?.includes(
              "Custom template for client:"
            );

            return (
              <Card
                key={template.id}
                className={`relative overflow-hidden cursor-pointer transition-all duration-500 group ${
                  selectedTemplate === template.id
                    ? isCustomized
                      ? "ring-4 ring-purple-500 shadow-2xl scale-105 bg-gradient-to-br from-purple-100 via-pink-100 to-purple-100"
                      : "ring-4 ring-blue-500 shadow-2xl scale-105 bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50"
                    : isCustomized
                    ? "hover:shadow-xl hover:-translate-y-2 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200"
                    : "hover:shadow-xl hover:-translate-y-2 bg-white border-2 border-blue-200"
                }`}
                onClick={() => handleTemplateSelect(template.id)}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* View Button */}
                <div className="absolute top-4 right-4 z-10">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-blue-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 transition-all duration-200 bg-white/70 backdrop-blur-sm rounded-full shadow-md px-2.5 py-1.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewingTemplate(template);
                    }}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>

                {/* Selection Badge */}
                {selectedTemplate === template.id && (
                  <div className="absolute top-4 left-4 z-10 animate-in zoom-in duration-300">
                    <div
                      className={`rounded-full p-2 shadow-lg ${
                        isCustomized
                          ? "bg-gradient-to-br from-purple-500 to-pink-600"
                          : "bg-gradient-to-br from-blue-500 to-indigo-600"
                      }`}
                    >
                      <CheckCircle className="w-6 h-6 text-white" />
                    </div>
                  </div>
                )}

                <CardHeader className="pb-4 pt-10">
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300 ${
                        isCustomized
                          ? "bg-gradient-to-br from-purple-500 to-pink-600"
                          : "bg-gradient-to-br from-blue-500 to-indigo-600"
                      }`}
                    >
                      {isCustomized ? (
                        <Sparkles className="w-6 h-6 text-white" />
                      ) : (
                        <Layers className="w-6 h-6 text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <CardTitle
                        className={`text-xl font-bold mb-2 transition-colors ${
                          isCustomized
                            ? "text-purple-900 group-hover:text-purple-600"
                            : "text-gray-900 group-hover:text-blue-600"
                        }`}
                      >
                        {template.name}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className={`text-xs font-semibold ${getStatusColor(
                          template.status
                        )}`}
                      >
                        {template.status || "Active"}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription
                    className={`text-sm ${
                      isCustomized ? "text-purple-700" : "text-blue-700"
                    } line-clamp-2`}
                  >
                    {template.description ||
                      "A template designed to meet your project needs."}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-0 pb-6">
                  <div className="flex items-center gap-3 mb-5">
                    {template._count?.sitesAssets && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>{template._count.sitesAssets} Assets</span>
                      </div>
                    )}
                    {template._count?.templateTeamMembers && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-100 text-pink-700 rounded-lg text-xs font-semibold">
                        <Users className="w-3.5 h-3.5" />
                        <span>
                          {template._count.templateTeamMembers} Members
                        </span>
                      </div>
                    )}
                  </div>

                  <Button
                    className={`w-full h-12 font-semibold transition-all duration-300 ${
                      selectedTemplate === template.id
                        ? isCustomized
                          ? "bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 text-white"
                          : "bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 text-white"
                        : isCustomized
                        ? "bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 border-2 border-purple-200"
                        : "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border-2 border-blue-200"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTemplateSelect(template.id);
                    }}
                  >
                    {selectedTemplate === template.id ? (
                      <span className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        Selected
                      </span>
                    ) : (
                      "Select Template"
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-8">
        <Button
          variant="outline"
          onClick={onPrevious}
          className="px-8 py-6 text-lg font-semibold border-2 rounded-xl"
        >
          Previous
        </Button>
        <Button
          onClick={onNext}
          disabled={!selectedTemplate}
          className="px-8 py-6 text-lg font-semibold bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 text-white rounded-xl shadow-xl disabled:opacity-50"
        >
          Continue to Next Step
        </Button>
      </div>

      {/* View Modal */}
      <TemplateViewModal
        isOpen={!!viewingTemplate}
        onClose={() => setViewingTemplate(null)}
        template={viewingTemplate}
      />
    </div>
  );
}
