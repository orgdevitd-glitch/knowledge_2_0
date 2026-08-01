import { NextResponse } from "next/server";

import { getMediaLimits } from "@/config/media-env";
import {
  adminAuthErrorResponse,
  requireAdminPrincipalForApi,
  AdminApiAuthError,
} from "@/server/auth/require-admin-api";
import { isAllowedOrigin } from "@/server/auth/session";
import { getMemoryMediaStorageForTests } from "@/server/composition/media-ports";
import { adminMediaUploadLimiter } from "@/server/http/admin-mutation";

export const dynamic = "force-dynamic";

/**
 * Memory-mode only: accepts PUT body for a short-lived one-time upload token.
 * GCS uploads go directly to the signed URL and never hit this route.
 *
 * Clients cannot supply an arbitrary storageKey — the token is bound server-side.
 */
export async function PUT(request: Request) {
  try {
    if (!isAllowedOrigin(request.headers.get("origin"))) {
      return NextResponse.json(
        { error: { code: "ACCESS_DENIED", message: "Invalid origin", fields: {} } },
        { status: 403 },
      );
    }
    await requireAdminPrincipalForApi();
    const limited = adminMediaUploadLimiter.take("media-upload-proxy");
    if (!limited.allowed) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests", fields: {} } },
        { status: 429 },
      );
    }

    const limits = getMediaLimits();
    if (limits.storageMode !== "memory") {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Upload proxy is only available in memory storage mode",
            fields: {},
          },
        },
        { status: 400 },
      );
    }

    const token = new URL(request.url).searchParams.get("token");
    if (!token) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Missing token", fields: {} } },
        { status: 400 },
      );
    }

    // Bound read by the larger kind ceiling; per-token maxBytes enforces kind limit.
    const hardCap = Math.max(limits.imageMaxBytes, limits.documentMaxBytes);
    const buf = Buffer.from(await request.arrayBuffer());
    if (buf.byteLength <= 0 || buf.byteLength > hardCap) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid body size", fields: {} } },
        { status: 400 },
      );
    }

    const storage = getMemoryMediaStorageForTests();
    try {
      const { storageKey } = storage.consumeUploadToken(token, {
        method: "PUT",
        bodyBytes: buf.byteLength,
      });
      storage.put(storageKey, new Uint8Array(buf), {
        contentType: "application/octet-stream",
      });
    } catch {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Upload token rejected",
            fields: {},
          },
        },
        { status: 400 },
      );
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof AdminApiAuthError) {
      return adminAuthErrorResponse(error);
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Upload failed", fields: {} } },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: { code: "METHOD_NOT_ALLOWED", message: "PUT only", fields: {} } },
    { status: 405 },
  );
}

export async function POST() {
  return NextResponse.json(
    { error: { code: "METHOD_NOT_ALLOWED", message: "PUT only", fields: {} } },
    { status: 405 },
  );
}
