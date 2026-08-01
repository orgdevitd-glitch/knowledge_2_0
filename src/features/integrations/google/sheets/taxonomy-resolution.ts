export type TaxonomyResolutionStatus =
  | "resolved"
  | "unresolved"
  | "ambiguous"
  | "archived";

export type TaxonomyLookupItem = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "archived";
};

export type TaxonomyTokenResolution = {
  token: string;
  status: TaxonomyResolutionStatus;
  matchedId?: string;
  candidates?: Array<{ id: string; name: string }>;
};

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

export function resolveTaxonomyTokens(
  tokens: string[],
  catalog: TaxonomyLookupItem[],
): TaxonomyTokenResolution[] {
  const active = catalog.filter((c) => c.status === "active");
  const archived = catalog.filter((c) => c.status === "archived");

  return tokens.map((token) => {
    const norm = normalizeToken(token);
    if (!norm) {
      return { token, status: "unresolved" as const };
    }

    const activeMatches = active.filter(
      (c) =>
        normalizeToken(c.name) === norm || normalizeToken(c.slug) === norm,
    );
    if (activeMatches.length === 1) {
      return {
        token,
        status: "resolved" as const,
        matchedId: activeMatches[0]!.id,
      };
    }
    if (activeMatches.length > 1) {
      return {
        token,
        status: "ambiguous" as const,
        candidates: activeMatches.map((c) => ({ id: c.id, name: c.name })),
      };
    }

    const archivedMatches = archived.filter(
      (c) =>
        normalizeToken(c.name) === norm || normalizeToken(c.slug) === norm,
    );
    if (archivedMatches.length >= 1) {
      return {
        token,
        status: "archived" as const,
        matchedId: archivedMatches[0]?.id,
        candidates: archivedMatches.map((c) => ({ id: c.id, name: c.name })),
      };
    }

    return { token, status: "unresolved" as const };
  });
}
