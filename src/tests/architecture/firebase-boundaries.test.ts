import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = join(process.cwd(), "src");

function walk(dir: string): string[] {
  const out: string[] = [];
  try {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (name === "tests") continue;
        out.push(...walk(full));
      } else if (/\.(ts|tsx)$/.test(name)) {
        out.push(full);
      }
    }
  } catch {
    return out;
  }
  return out;
}

describe("architecture: firebase boundaries", () => {
  it("domain does not import firebase", () => {
    const offenders: string[] = [];
    for (const file of walk(join(ROOT, "domain"))) {
      const text = readFileSync(file, "utf8");
      if (/from ["']firebase|from ["']firebase-admin|firebase-admin/.test(text)) {
        offenders.push(relative(process.cwd(), file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("client components do not import firebase-admin or server auth", () => {
    const offenders: string[] = [];
    for (const file of walk(ROOT)) {
      if (file.includes(`${join("src", "tests")}`)) continue;
      const text = readFileSync(file, "utf8");
      if (!text.includes('"use client"') && !text.includes("'use client'")) {
        continue;
      }
      if (
        /firebase-admin/.test(text) ||
        /from ["']@\/server\/firebase/.test(text) ||
        /from ["']@\/server\/auth\/guard/.test(text) ||
        /from ["']@\/config\/env["']/.test(text)
      ) {
        offenders.push(relative(process.cwd(), file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("repository interfaces do not use Firestore SDK types", () => {
    const offenders: string[] = [];
    for (const file of walk(
      join(ROOT, "server", "repositories", "interfaces"),
    )) {
      const text = readFileSync(file, "utf8");
      if (
        /from ["']firebase|from ["']firebase-admin|Firestore\.|FirebaseFirestore/.test(
          text,
        )
      ) {
        offenders.push(relative(process.cwd(), file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no service account key material in application src", () => {
    const offenders: string[] = [];
    const pemMarker = ["BEGIN", "PRIVATE", "KEY"].join(" ");
    for (const file of walk(ROOT)) {
      if (file.includes(`${join("src", "tests")}`)) continue;
      const text = readFileSync(file, "utf8");
      if (text.includes(pemMarker) || /"private_key"\s*:/.test(text)) {
        offenders.push(relative(process.cwd(), file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
