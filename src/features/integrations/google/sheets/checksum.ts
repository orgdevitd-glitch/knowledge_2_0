import { createHash } from "node:crypto";

export function checksumPromptSheetNormalized(input: {
  schemaVersion: number;
  headers: string[];
  rows: Array<Record<string, string>>;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        schemaVersion: input.schemaVersion,
        headers: input.headers,
        rows: input.rows,
      }),
    )
    .digest("hex");
}
