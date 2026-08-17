import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminApiAuthError } from "@/server/auth/require-admin-api";
import type { AdminPrincipal } from "@/server/auth/principal";
import { adminPickerLimiter } from "@/server/http/admin-mutation";
import {
  PICKER_CACHE_CONTROL,
  PICKER_MEDIA_ITEM_KEYS,
  PICKER_RESULT_LIMIT,
} from "@/features/admin/pickers/picker-limits";
import {
  createMediaAsset,
  markMediaReady,
} from "@/domain/content/media";
import { createTestPorts, TEST_NOW } from "../builders/content";

const mocks = vi.hoisted(() => ({
  requireAdminPrincipalForApi: vi.fn(),
  getContentPorts: vi.fn(),
}));

vi.mock("@/server/auth/require-admin-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/auth/require-admin-api")>();
  return {
    ...actual,
    requireAdminPrincipalForApi: mocks.requireAdminPrincipalForApi,
  };
});

vi.mock("@/server/composition/content-ports", () => ({
  getContentPorts: () => mocks.getContentPorts(),
}));

function principal(uid: string): AdminPrincipal {
  return {
    uid,
    email: `${uid}@example.com`,
    displayName: uid,
    role: "admin",
    sessionIssuedAt: "2026-01-01T00:00:00.000Z",
  };
}

async function readyMedia(
  ports: ReturnType<typeof createTestPorts>,
  id: string,
  title: string,
) {
  const created = createMediaAsset({
    id,
    title,
    kind: "image",
    originalFileName: `${id}.jpg`,
    storageProvider: "memory",
    storageKey: `media/${id}/abc`,
    ownerId: "user_1",
    now: TEST_NOW,
  });
  const ready = markMediaReady(
    created,
    {
      mimeType: "image/jpeg",
      sizeBytes: 100,
      providerGeneration: "1",
      providerChecksum: null,
      providerEtag: '"1"',
    },
    TEST_NOW,
  );
  await ports.mediaRepo.save(ready, { expectedRevision: 0 });
}

describe("GET /api/admin/pickers/*", () => {
  afterEach(() => {
    adminPickerLimiter.clear();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    adminPickerLimiter.clear();
    mocks.requireAdminPrincipalForApi.mockReset();
    mocks.getContentPorts.mockReset();
  });

  it("fails closed without an admin principal", async () => {
    const { GET } = await import("@/app/api/admin/pickers/media/route");
    mocks.requireAdminPrincipalForApi.mockRejectedValue(
      new AdminApiAuthError(401, "AUTH_REQUIRED", "Authentication required"),
    );
    const res = await GET(new Request("http://localhost/api/admin/pickers/media"));
    expect(res.status).toBe(401);
    expect(mocks.getContentPorts).not.toHaveBeenCalled();
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("rejects materials picker without admin principal", async () => {
    const { GET } = await import("@/app/api/admin/pickers/materials/route");
    mocks.requireAdminPrincipalForApi.mockRejectedValue(
      new AdminApiAuthError(401, "AUTH_REQUIRED", "Authentication required"),
    );
    const res = await GET(
      new Request("http://localhost/api/admin/pickers/materials?type=article"),
    );
    expect(res.status).toBe(401);
    expect(mocks.getContentPorts).not.toHaveBeenCalled();
  });

  it("returns private no-store allowlisted media DTOs", async () => {
    const { GET } = await import("@/app/api/admin/pickers/media/route");
    const ports = createTestPorts();
    await readyMedia(ports, "media_ok", "Hero");
    mocks.requireAdminPrincipalForApi.mockResolvedValue(principal("admin_a"));
    mocks.getContentPorts.mockReturnValue(ports);

    const res = await GET(new Request("http://localhost/api/admin/pickers/media"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe(PICKER_CACHE_CONTROL);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    const body = (await res.json()) as { items: Array<Record<string, unknown>> };
    expect(body.items).toHaveLength(1);
    expect(Object.keys(body.items[0]!).sort()).toEqual(
      [...PICKER_MEDIA_ITEM_KEYS].sort(),
    );
    expect(JSON.stringify(body)).not.toMatch(
      /storageKey|bucket|ownerId|providerGeneration|gs:\/\/|promptText|body/,
    );
    expect(body.items[0]?.publicPath).toBe("/media/media_ok");
  });

  it("caps results even when the client asks for more", async () => {
    const { GET } = await import("@/app/api/admin/pickers/media/route");
    const ports = createTestPorts();
    for (let i = 0; i < 25; i += 1) {
      await readyMedia(ports, `media_${i}`, `Asset ${i}`);
    }
    mocks.requireAdminPrincipalForApi.mockResolvedValue(principal("admin_a"));
    mocks.getContentPorts.mockReturnValue(ports);
    const res = await GET(
      new Request("http://localhost/api/admin/pickers/media?limit=999&sort=title"),
    );
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items.length).toBe(PICKER_RESULT_LIMIT);
  });

  it("does not mutate on unsupported methods", async () => {
    const media = await import("@/app/api/admin/pickers/media/route");
    const materials = await import("@/app/api/admin/pickers/materials/route");
    mocks.requireAdminPrincipalForApi.mockResolvedValue(principal("admin_a"));
    expect(media.POST().status).toBe(405);
    expect(media.PUT().status).toBe(405);
    expect(media.PATCH().status).toBe(405);
    expect(media.DELETE().status).toBe(405);
    expect(materials.POST().status).toBe(405);
    expect(mocks.getContentPorts).not.toHaveBeenCalled();
  });

  it("rate-limits per admin uid, not a shared admin bucket", async () => {
    const { GET } = await import("@/app/api/admin/pickers/media/route");
    const ports = createTestPorts();
    mocks.getContentPorts.mockReturnValue(ports);

    mocks.requireAdminPrincipalForApi.mockResolvedValue(principal("admin_a"));
    let limited = false;
    for (let i = 0; i < 70; i += 1) {
      const res = await GET(new Request("http://localhost/api/admin/pickers/media"));
      if (res.status === 429) {
        limited = true;
        break;
      }
    }
    expect(limited).toBe(true);

    mocks.requireAdminPrincipalForApi.mockResolvedValue(principal("admin_b"));
    const other = await GET(new Request("http://localhost/api/admin/pickers/media"));
    expect(other.status).toBe(200);
  });
});
