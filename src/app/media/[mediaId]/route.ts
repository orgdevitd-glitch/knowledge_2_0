import { NextResponse } from "next/server";

import { isPubliclyDeliverable } from "@/domain/content/media";
import { getContentPorts } from "@/server/composition/content-ports";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ mediaId: string }> };

function safeContentDisposition(
  kind: "inline" | "attachment",
  fileName: string,
): string {
  const ascii = fileName
    .replace(/[\r\n]/g, "")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\/<>:|?*]/g, "_")
    .slice(0, 180);
  const fallback = ascii || "file";
  return `${kind}; filename="${fallback}"`;
}

export async function GET(_request: Request, { params }: Params) {
  const { mediaId } = await params;
  try {
    const ports = getContentPorts();
    if (!ports.media || !ports.mediaStorage) {
      return new NextResponse(null, { status: 404 });
    }
    const media = await ports.media.getById(mediaId);
    if (!media || !isPubliclyDeliverable(media) || !media.mimeType) {
      return new NextResponse(null, { status: 404 });
    }

    const { stream, sizeBytes } = await ports.mediaStorage.openObjectStream(
      media.storageKey,
    );
    const isImage = media.kind === "image";
    const headers = new Headers({
      "Content-Type": media.mimeType,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=60, must-revalidate",
      "Content-Disposition": safeContentDisposition(
        isImage ? "inline" : "attachment",
        media.originalFileName,
      ),
    });
    if (sizeBytes != null && Number.isFinite(sizeBytes) && sizeBytes >= 0) {
      headers.set("Content-Length", String(sizeBytes));
    }
    // Range requests are not supported in Phase 7B.
    return new NextResponse(stream, { status: 200, headers });
  } catch (error) {
    // Never leak storageKey, bucket, signed URLs, or provider internals.
    console.error("public media delivery failed", {
      mediaId,
      message: error instanceof Error ? error.message : "unknown",
    });
    return new NextResponse(null, { status: 404 });
  }
}
