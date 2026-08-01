import "server-only";

import { revalidatePath } from "next/cache";

import { resetPublicContentCompositionForTests } from "@/server/composition/public-content";
import { logger } from "@/lib/logger";

/**
 * Port for invalidating public read caches after content mutations.
 * Domain and use cases must not import Next.js APIs directly.
 */
export interface PublicContentInvalidationPort {
  invalidateArticle(input: {
    slug: string;
    previousSlug?: string | null;
  }): void;
  invalidateCatalogs(): void;
}

/**
 * Next.js App Router adapter using revalidatePath for known public routes.
 */
export class NextPublicContentInvalidation
  implements PublicContentInvalidationPort
{
  invalidateCatalogs(): void {
    try {
      revalidatePath("/");
      revalidatePath("/materials");
      revalidatePath("/articles");
      revalidatePath("/prompts");
      revalidatePath("/search");
      revalidatePath("/sitemap.xml");
      resetPublicContentCompositionForTests();
    } catch (error) {
      logger.warn("public cache invalidation failed", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  invalidateArticle(input: {
    slug: string;
    previousSlug?: string | null;
  }): void {
    try {
      this.invalidateCatalogs();
      revalidatePath(`/articles/${input.slug}`);
      if (input.previousSlug && input.previousSlug !== input.slug) {
        revalidatePath(`/articles/${input.previousSlug}`);
      }
    } catch (error) {
      logger.warn("article cache invalidation failed", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }
}

let cached: PublicContentInvalidationPort | null = null;

export function getPublicContentInvalidation(): PublicContentInvalidationPort {
  if (!cached) {
    cached = new NextPublicContentInvalidation();
  }
  return cached;
}

export function setPublicContentInvalidationForTests(
  port: PublicContentInvalidationPort,
): void {
  cached = port;
}

export function resetPublicContentInvalidationForTests(): void {
  cached = null;
}
