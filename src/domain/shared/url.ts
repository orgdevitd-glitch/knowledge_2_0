import { z } from "zod";

import { ValidationError } from "./errors";
import type { Brand } from "./ids";
import { CONTENT_LIMITS } from "./limits";

export type SafeUrl = Brand<string, "SafeUrl">;

const FORBIDDEN_SCHEMES =
  /^(javascript|data|vbscript|file|chrome|about|blob):/i;

export type UrlValidationOptions = {
  allowMailto?: boolean;
  allowRelative?: boolean;
  requireHttpsAbsolute?: boolean;
};

/**
 * Shared URL validator for ExternalReference, Link, Button.
 * Relative internal paths and HTTPS absolute URLs are allowed by default.
 */
export function parseSafeUrl(
  value: unknown,
  options: UrlValidationOptions = {},
): SafeUrl {
  const {
    allowMailto = false,
    allowRelative = true,
    requireHttpsAbsolute = false,
  } = options;

  const result = z
    .string()
    .min(1)
    .max(CONTENT_LIMITS.url.max)
    .safeParse(value);
  if (!result.success) {
    throw new ValidationError("Invalid URL", {
      issues: result.error.issues.map((i) => i.message),
    });
  }

  const raw = result.data.trim();
  if (/[\u0000-\u001F\u007F]/.test(raw)) {
    throw new ValidationError("URL must not contain control characters");
  }
  if (raw.startsWith("//")) {
    throw new ValidationError("Protocol-relative URLs are not allowed");
  }
  if (FORBIDDEN_SCHEMES.test(raw)) {
    throw new ValidationError("Unsafe URL scheme", { schemeHint: raw.slice(0, 16) });
  }

  if (raw.startsWith("mailto:")) {
    if (!allowMailto) {
      throw new ValidationError("mailto: is not allowed here");
    }
    if (!/^mailto:[^\s]+@[^\s]+$/i.test(raw)) {
      throw new ValidationError("Invalid mailto URL");
    }
    return raw as SafeUrl;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new ValidationError("Malformed absolute URL");
    }
    if (parsed.protocol !== "https:") {
      if (requireHttpsAbsolute || parsed.protocol !== "http:") {
        throw new ValidationError("Only HTTPS absolute URLs are allowed", {
          protocol: parsed.protocol,
        });
      }
      throw new ValidationError("Only HTTPS absolute URLs are allowed", {
        protocol: parsed.protocol,
      });
    }
    return parsed.toString() as SafeUrl;
  }

  if (!allowRelative) {
    throw new ValidationError("Relative URLs are not allowed");
  }

  if (!raw.startsWith("/") || raw.startsWith("//")) {
    throw new ValidationError(
      "Relative URL must start with a single /",
    );
  }

  return raw as SafeUrl;
}

export type ExternalReference = {
  url: SafeUrl;
  label?: string;
};

export function parseExternalReference(
  value: unknown,
  options?: UrlValidationOptions,
): ExternalReference {
  const schema = z.object({
    url: z.string(),
    label: z.string().max(200).optional(),
  });
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ValidationError("Invalid ExternalReference");
  }
  return {
    url: parseSafeUrl(parsed.data.url, {
      requireHttpsAbsolute: true,
      allowRelative: false,
      ...options,
    }),
    label: parsed.data.label,
  };
}
