import "server-only";

import { getAdminEmailAllowlist } from "@/config/env";
import { logger } from "@/lib/logger";

export interface AdminAccessPolicy {
  isAllowed(input: {
    email: string | null | undefined;
    emailVerified: boolean;
  }): boolean;
}

export class EnvironmentAllowlistAdminAccessPolicy
  implements AdminAccessPolicy
{
  isAllowed(input: {
    email: string | null | undefined;
    emailVerified: boolean;
  }): boolean {
    if (!input.emailVerified) return false;
    if (!input.email) return false;
    const normalized = input.email.trim().toLowerCase();
    const allowlist = getAdminEmailAllowlist();
    return allowlist.includes(normalized);
  }
}

export function logAccessDenied(reason: string, meta?: Record<string, unknown>): void {
  logger.warn("admin access denied", {
    reason,
    ...meta,
  });
}

export const defaultAdminAccessPolicy =
  new EnvironmentAllowlistAdminAccessPolicy();
