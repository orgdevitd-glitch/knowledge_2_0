import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx)$/.test(name)) acc.push(p);
  }
  return acc;
}

describe("media architecture boundaries", () => {
  it("client admin media components do not import firebase-admin, storage, or gcs adapters", () => {
    const clientDir = join(root, "src/features/admin/media/components");
    const clientApi = join(
      root,
      "src/features/admin/media/client/admin-media-api.ts",
    );
    const files = [...walk(clientDir), clientApi];
    const forbidden =
      /firebase-admin|@google-cloud\/storage|gcs-media-storage|getFirebaseAdmin|server\/storage\/gcs/i;
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      expect(src, file).not.toMatch(forbidden);
    }
  });

  it("markMediaReady exists and domain has no file.replaced audit type", () => {
    const mediaSrc = readFileSync(
      join(root, "src/domain/content/media.ts"),
      "utf8",
    );
    expect(mediaSrc).toMatch(/export function markMediaReady/);
    expect(mediaSrc).not.toMatch(/file\.replaced/);

    const auditSrc = readFileSync(
      join(root, "src/domain/content/audit.ts"),
      "utf8",
    );
    expect(auditSrc).not.toMatch(/media\.file\.replaced/);
  });

  it("storage.rules deny all client read/write", () => {
    const rules = readFileSync(join(root, "storage.rules"), "utf8");
    expect(rules).toMatch(/allow read, write: if false/);
  });

  it("media-env does not read NEXT_PUBLIC credentials", () => {
    const src = readFileSync(join(root, "src/config/media-env.ts"), "utf8");
    expect(src).not.toMatch(/NEXT_PUBLIC_/);
    const gcs = readFileSync(
      join(root, "src/server/storage/gcs-media-storage.ts"),
      "utf8",
    );
    expect(gcs).not.toMatch(/NEXT_PUBLIC_/);
  });

  it("media use cases never emit media.file.replaced", () => {
    const src = readFileSync(
      join(root, "src/features/content/application/media-use-cases.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/media\.file\.replaced/);
    expect(src).toMatch(/assertMediaBinaryImmutable/);
  });

  it("media mutation routes use runAdminMutation", () => {
    const apiRoot = join(root, "src/app/api/admin/media");
    const files = walk(apiRoot).filter((f) => f.endsWith("route.ts"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      if (file.includes("upload-proxy")) {
        continue;
      }
      expect(src, file).toMatch(/runAdminMutation/);
    }
  });
});
