// app/api/templates/[id]/add-assets/route.ts
// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { SiteAssetType } from "@prisma/client";

/**
 * Add new site assets to an existing template
 * Useful for adding assets to custom templates
 * 
 * POST /api/templates/{templateId}/add-assets
 * Body: {
 *   assets: Array<{
 *     type: SiteAssetType,
 *     name: string,
 *     url?: string,
 *     description?: string,
 *     isRequired: boolean,
 *     defaultPostingFrequency?: number,
 *     defaultIdealDurationMinutes?: number
 *   }>
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: templateId } = await params;

  try {
    const body = await request.json();
    const { assets } = body as {
      assets: Array<{
        type: SiteAssetType;
        name: string;
        url?: string;
        description?: string;
        isRequired: boolean;
        defaultPostingFrequency?: number;
        defaultIdealDurationMinutes?: number;
      }>;
    };

    if (!assets || !Array.isArray(assets) || assets.length === 0) {
      return NextResponse.json(
        { message: "assets array is required and must not be empty" },
        { status: 400 }
      );
    }

    const actorId =
      (request.headers.get("x-actor-id") as string) ||
      (request.nextUrl.searchParams.get("actorId") as string) ||
      null;

    const result = await prisma.$transaction(async (tx) => {
      // Check if template exists
      const template = await tx.template.findUnique({
        where: { id: templateId },
      });

      if (!template) {
        throw new Error("TEMPLATE_NOT_FOUND");
      }

      // Create all new assets
      const createdAssets = [];
      for (const assetData of assets) {
        const newAsset = await tx.templateSiteAsset.create({
          data: {
            templateId,
            type: assetData.type,
            name: assetData.name,
            url: assetData.url || null,
            description: assetData.description || null,
            isRequired: assetData.isRequired,
            defaultPostingFrequency: assetData.defaultPostingFrequency ?? null,
            defaultIdealDurationMinutes:
              assetData.defaultIdealDurationMinutes ?? null,
          },
        });
        createdAssets.push(newAsset);
      }

      // Activity log
      await tx.activityLog.create({
        data: {
          id: crypto.randomUUID(),
          entityType: "Template",
          entityId: templateId,
          userId: actorId,
          action: "add_assets",
          details: {
            templateName: template.name,
            assetsAdded: createdAssets.length,
            assets: createdAssets.map((a) => ({
              id: a.id,
              name: a.name,
              type: a.type,
            })),
          },
        },
      });

      return {
        template,
        createdAssets,
      };
    });

    return NextResponse.json(
      {
        message: "Assets added successfully to template",
        template: result.template,
        createdAssets: result.createdAssets,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error?.message === "TEMPLATE_NOT_FOUND") {
      return NextResponse.json(
        { message: "Template not found" },
        { status: 404 }
      );
    }
    console.error("Add assets to template error:", error);
    return NextResponse.json(
      {
        message: "Failed to add assets to template",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
