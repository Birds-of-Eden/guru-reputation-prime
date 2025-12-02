// app/api/drive/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const GOOGLE_API = "https://www.googleapis.com/drive/v3";

/** Build Content-Disposition for downloads */
function contentDisposition(filename: string, fallbackId: string) {
  const ascii = filename.replace(/[^\x20-\x7E]+/g, "_");
  const safe = ascii.length ? ascii : `file-${fallbackId}`;
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

/** Direct-view URL for Drive image by id */
function viewUrl(fileId: string) {
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get("folderId"); // list files
    const mediaId = searchParams.get("id"); // single file stream
    const zipFolderId = searchParams.get("zipFolderId"); // (placeholder)
    const filename = searchParams.get("filename") || "";

    // ---- Take token from session (preferred). We keep query support only as a fallback for legacy. ----
    const session: any = await getServerSession(authOptions as any);
    const sessionToken =
      (session?.user as any)?.googleAccessToken?.toString() || null;
    const queryToken = searchParams.get("accessToken"); // optional legacy
    const accessToken = sessionToken || queryToken || null;

    const apiKey = process.env.GOOGLE_DRIVE_API_KEY;

    if (!apiKey && !accessToken) {
      return NextResponse.json(
        {
          error:
            "Server misconfigured: missing GOOGLE_DRIVE_API_KEY or Access Token",
        },
        { status: 500 }
      );
    }

    // Build auth header & query param
    const authHeader = accessToken
      ? { Authorization: `Bearer ${accessToken}` }
      : undefined;
    const authParam = accessToken ? "" : `&key=${apiKey}`;

    // ---- Zip (not implemented here) ----
    if (zipFolderId) {
      return NextResponse.json(
        { error: "Zip streaming is not implemented on this server." },
        { status: 501 }
      );
    }

    // ---- LIST: files in a folder ----
    if (folderId) {
      // 1) Folder metadata (also checks permission)
      const metaUrl =
        `${GOOGLE_API}/files/${folderId}?fields=id,name,mimeType` +
        `&supportsAllDrives=true${authParam}`;

      const metaRes = await fetch(metaUrl, {
        cache: "no-store",
        headers: authHeader,
      });

      if (!metaRes.ok) {
        const googleErr = await metaRes.text().catch(() => "");
        const msg = accessToken
          ? "User is not authorized for this private folder or folder not found."
          : "Folder is not public or not found.";
        return NextResponse.json(
          { error: msg, googleError: googleErr },
          { status: metaRes.status }
        );
      }

      const metadata = await metaRes.json();
      if (metadata.mimeType !== "application/vnd.google-apps.folder") {
        return NextResponse.json(
          { error: "The provided ID is not a Google Drive folder." },
          { status: 400 }
        );
      }

      // 2) List image files with pagination
      const files: any[] = [];
      let pageToken: string | undefined;
      const fields =
        "nextPageToken,files(id,name,mimeType,webViewLink,thumbnailLink)";

      do {
        const params = new URLSearchParams({
          q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
          fields,
          pageSize: "1000",
          includeItemsFromAllDrives: "true",
          supportsAllDrives: "true",
        });

        if (!accessToken && apiKey) params.set("key", apiKey);
        if (pageToken) params.set("pageToken", pageToken);

        const listRes = await fetch(
          `${GOOGLE_API}/files?${params.toString()}`,
          {
            cache: "no-store",
            headers: authHeader,
          }
        );

        if (!listRes.ok) {
          const googleErr = await listRes.text().catch(() => "");
          return NextResponse.json(
            {
              error: "Failed to list files from Google Drive.",
              googleError: googleErr,
            },
            { status: listRes.status }
          );
        }

        const data = await listRes.json();
        files.push(...(data.files || []));
        pageToken = data.nextPageToken;
      } while (pageToken);

      const images = files.map((f) => ({
        id: f.id as string,
        name: f.name as string,
        mimeType: f.mimeType as string,
        webViewLink:
          f.webViewLink ?? `https://drive.google.com/file/d/${f.id}/view`,
        thumbnail:
          f.thumbnailLink ??
          `https://drive.google.com/thumbnail?sz=w400&id=${f.id}`,
        viewUrl: viewUrl(f.id),
      }));

      return NextResponse.json({
        folder: { id: metadata.id, name: metadata.name },
        count: images.length,
        images,
      });
    }

    // ---- MEDIA: stream a single file ----
    if (mediaId) {
      const mediaUrl = `${GOOGLE_API}/files/${mediaId}?alt=media&supportsAllDrives=true${authParam}`;

      const upstream = await fetch(mediaUrl, {
        cache: "no-store",
        headers: authHeader,
      });

      if (!upstream.ok) {
        const googleErr = await upstream.text().catch(() => "");
        return NextResponse.json(
          {
            error: "Failed to fetch media. Check permissions.",
            googleError: googleErr,
          },
          { status: upstream.status }
        );
      }

      const contentType =
        upstream.headers.get("content-type") ?? "application/octet-stream";
      const contentLength = upstream.headers.get("content-length");

      const headers = new Headers({
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        "Content-Disposition": contentDisposition(
          filename || mediaId || "download",
          mediaId
        ),
      });
      if (contentLength) headers.set("Content-Length", contentLength);

      return new Response(upstream.body, { headers });
    }

    // ---- Missing params ----
    return NextResponse.json(
      {
        error: "Missing required parameter: 'folderId', 'id', or 'zipFolderId'",
      },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("DRIVE API ERROR:", err);
    return NextResponse.json(
      {
        error: "Unexpected server error",
        details: err?.message ?? String(err),
      },
      { status: 500 }
    );
  }
}
