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

describe("prompt admin architecture boundaries", () => {
  it("client prompt admin components do not import firebase-admin or firestore adapters", () => {
    const clientDir = join(root, "src/features/admin/prompts/components");
    const clientApi = join(
      root,
      "src/features/admin/prompts/client/admin-prompts-api.ts",
    );
    const files = [...walk(clientDir), clientApi];
    const forbidden =
      /firebase-admin|firestore-prompt-repository|getFirebaseAdmin|server\/repositories\/firestore/i;
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      expect(src, file).not.toMatch(forbidden);
      expect(src, file).not.toMatch(/dangerouslySetInnerHTML/);
    }
  });

  it("prompt domain does not import React or Next", () => {
    const src = readFileSync(join(root, "src/domain/content/prompt.ts"), "utf8");
    expect(src).not.toMatch(/from ["']react["']/);
    expect(src).not.toMatch(/from ["']next\//);
  });

  it("prompt mutation routes use runAdminMutation", () => {
    const apiRoot = join(root, "src/app/api/admin/prompts");
    const files = walk(apiRoot);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      expect(src, file).toMatch(/runAdminMutation/);
      expect(src, file).not.toMatch(/\bDELETE\b/);
      expect(src, file).not.toMatch(/deletePrompt|physical delete/i);
    }
  });

  it("prompt use cases never auto-publish on create/update", () => {
    const src = readFileSync(
      join(root, "src/features/content/application/prompt-use-cases.ts"),
      "utf8",
    );
    expect(src).toMatch(/export async function createPromptUseCase/);
    expect(src).toMatch(/export async function publishPrompt/);
    const createFn = src.slice(
      src.indexOf("export async function createPromptUseCase"),
      src.indexOf("export async function updatePrompt"),
    );
    expect(createFn).not.toMatch(/markPromptPublished|publishPrompt\(/);
  });

  it("publish must not wipe import provenance via portalSource()", () => {
    const src = readFileSync(join(root, "src/domain/content/prompt.ts"), "utf8");
    const fn = src.slice(src.indexOf("export function markPromptPublished"));
    const end = fn.indexOf("\nexport function ");
    const body = end >= 0 ? fn.slice(0, end) : fn;
    expect(body).toMatch(/source:\s*prompt\.source/);
    expect(body).not.toMatch(/portalSource\(\)/);
  });

  it("Sheets preview matching uses findBySourceExternalId not truncated list", () => {
    const src = readFileSync(
      join(
        root,
        "src/features/integrations/google/application/create-import-preview.ts",
      ),
      "utf8",
    );
    expect(src).toMatch(/findBySourceExternalId/);
    expect(src).not.toMatch(/listAdminPrompts|list\(\{\},\s*\{\s*limit:\s*100/);
  });
});
