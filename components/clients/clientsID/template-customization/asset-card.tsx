// components/clients/clientsID/template-customization/asset-card.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Globe,
  Hash,
  Clock,
  Lock,
  Zap,
  Link as LinkIcon,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

interface AssetCardProps {
  asset: any;
  setting?: any;
  isCustomTemplate: boolean;
  canManage: boolean;
}

export function AssetCard({
  asset,
  setting,
  isCustomTemplate,
  canManage,
}: AssetCardProps) {
  const hasOverride = setting?.requiredFrequency !== null &&
    setting?.requiredFrequency !== asset.defaultPostingFrequency;

  const displayFrequency = setting?.requiredFrequency ?? asset.defaultPostingFrequency ?? 0;
  const displayDuration = setting?.idealDurationMinutes ?? asset.defaultIdealDurationMinutes ?? 0;

  const getTypeIcon = (type: string) => {
    if (type?.includes("social")) return "📱";
    if (type?.includes("web")) return "🌐";
    if (type?.includes("graphics")) return "🎨";
    if (type?.includes("content")) return "✍️";
    return "📄";
  };

  const getTypeBadgeColor = (type: string) => {
    if (type?.includes("social")) return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
    if (type?.includes("web")) return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
    if (type?.includes("graphics")) return "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300";
    if (type?.includes("content")) return "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300";
    return "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300";
  };

  return (
    <Card className="border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left Section - Asset Info */}
          <div className="flex-1 space-y-3">
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="text-2xl mt-0.5">
                {getTypeIcon(asset.type)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                    {asset.name}
                  </h4>
                  <Badge className={getTypeBadgeColor(asset.type)}>
                    {asset.type?.replace(/_/g, " ")}
                  </Badge>
                  {asset.isRequired && (
                    <Badge variant="outline" className="border-red-300 text-red-700 dark:border-red-700 dark:text-red-400">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Required
                    </Badge>
                  )}
                </div>
                
                {asset.description && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {asset.description}
                  </p>
                )}

                {asset.url && (
                  <a
                    href={asset.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
                  >
                    <LinkIcon className="h-3 w-3" />
                    {asset.url}
                  </a>
                )}
              </div>
            </div>

            {/* Settings Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Posting Frequency */}
              <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                <div className="p-1.5 bg-blue-500 rounded">
                  <Hash className="h-3.5 w-3.5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Posting Frequency
                  </p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                    {displayFrequency > 0 ? `${displayFrequency}/month` : "Not set"}
                    {hasOverride && (
                      <Zap className="h-3 w-3 text-yellow-500" aria-label="Client Override" />
                    )}
                    {!hasOverride && displayFrequency > 0 && (
                      <Lock className="h-3 w-3 text-slate-400" aria-label="Template Default" />
                    )}
                  </p>
                </div>
              </div>

              {/* Duration */}
              <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                <div className="p-1.5 bg-purple-500 rounded">
                  <Clock className="h-3.5 w-3.5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Duration
                  </p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {displayDuration > 0 ? `${displayDuration} min` : "Not set"}
                  </p>
                </div>
              </div>
            </div>

            {/* Override Info */}
            {hasOverride && (
              <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                <Zap className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                <p className="text-xs text-yellow-700 dark:text-yellow-400">
                  <span className="font-semibold">Client Override:</span> Using custom frequency of {displayFrequency}/month 
                  (template default: {asset.defaultPostingFrequency}/month)
                </p>
              </div>
            )}

            {/* Template Source */}
            {!isCustomTemplate && (
              <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                <Lock className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  Shared template asset - customize to make client-specific changes
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
