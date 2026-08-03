"use client";

import { useEffect } from "react";

import {
  consumeSearchFocusIntent,
  prefersReducedMotion,
} from "@/features/search/ui/search-focus-intent";

/**
 * Focus/scroll to #search-results only when:
 * - fragment is present, AND
 * - an explicit search UX action marked focus intent (submit / next / cursor CTA).
 * Shared URLs and Back/Forward without intent do not steal focus.
 */
export function SearchResultsFocus({
  regionId = "search-results",
}: {
  regionId?: string;
}) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== `#${regionId}`) return;
    if (!consumeSearchFocusIntent()) return;
    const el = document.getElementById(regionId);
    if (!el) return;
    el.focus({ preventScroll: true });
    if (typeof el.scrollIntoView === "function") {
      el.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "start",
      });
    }
  }, [regionId]);

  return null;
}
