/**
 * Read a request body with a hard byte cap before JSON.parse.
 * Content-Length is an early hint only — actual bytes are always counted.
 */

export type BoundedBodyResult =
  | { ok: true; value: unknown }
  | {
      ok: false;
      reason: "too_large" | "invalid_json" | "empty" | "invalid_content_length";
    };

export async function readBoundedJsonBody(
  request: Request,
  maxBytes: number,
): Promise<BoundedBodyResult> {
  const contentLength = request.headers.get("content-length");
  if (contentLength != null) {
    const trimmed = contentLength.trim();
    if (!/^\d+$/.test(trimmed)) {
      return { ok: false, reason: "invalid_content_length" };
    }
    const n = Number(trimmed);
    if (!Number.isSafeInteger(n) || n < 0) {
      return { ok: false, reason: "invalid_content_length" };
    }
    if (n > maxBytes) {
      return { ok: false, reason: "too_large" };
    }
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return { ok: false, reason: "empty" };
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // ignore cancel errors
        }
        return { ok: false, reason: "too_large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "invalid_json" };
  }

  if (total === 0) {
    return { ok: false, reason: "empty" };
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder("utf-8").decode(merged);
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
}
