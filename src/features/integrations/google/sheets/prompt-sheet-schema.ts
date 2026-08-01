export const PROMPT_SHEET_SCHEMA_VERSION = 1 as const;

export const PROMPT_SHEET_REQUIRED_KEYS = [
  "external_id",
  "title",
  "prompt_text",
] as const;

export const PROMPT_SHEET_OPTIONAL_KEYS = [
  "summary",
  "categories",
  "tags",
  "audiences",
  "input_requirements",
  "output_requirements",
  "restrictions",
  "usage_example",
  "review_due_at",
] as const;

export type PromptSheetColumnKey =
  | (typeof PROMPT_SHEET_REQUIRED_KEYS)[number]
  | (typeof PROMPT_SHEET_OPTIONAL_KEYS)[number];

/** Stable schema keys → Russian header aliases (exact match only). */
export const PROMPT_SHEET_HEADER_ALIASES: Record<
  PromptSheetColumnKey,
  readonly string[]
> = {
  external_id: ["external_id", "Внешний ID"],
  title: ["title", "Название"],
  prompt_text: ["prompt_text", "Текст промта"],
  summary: ["summary", "Краткое описание"],
  categories: ["categories", "Категории"],
  tags: ["tags", "Теги"],
  audiences: ["audiences", "Аудитории"],
  input_requirements: ["input_requirements", "Входные данные"],
  output_requirements: ["output_requirements", "Формат результата"],
  restrictions: ["restrictions", "Ограничения"],
  usage_example: ["usage_example", "Пример использования"],
  review_due_at: ["review_due_at", "Дата следующей проверки"],
};

export const PROMPT_SHEET_LIST_DELIMITER = ";";

export const PORTAL_SCHEMA_SHEET_NAME = "_portal_schema";

export type PortalSchemaMarker = {
  schemaVersion: number;
  contentType: string;
  dataSheet: string;
  headerRow: number;
};

export type PromptSheetHeaderMap = Partial<Record<PromptSheetColumnKey, number>>;

export function normalizeSheetHeader(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function mapPromptSheetHeaders(
  headerRow: string[],
): { map: PromptSheetHeaderMap; missingRequired: PromptSheetColumnKey[] } {
  const normalizedHeaders = headerRow.map(normalizeSheetHeader);
  const map: PromptSheetHeaderMap = {};
  const assigned = new Set<number>();

  for (const [key, aliases] of Object.entries(PROMPT_SHEET_HEADER_ALIASES) as Array<
    [PromptSheetColumnKey, readonly string[]]
  >) {
    for (let i = 0; i < normalizedHeaders.length; i += 1) {
      if (assigned.has(i)) continue;
      const header = normalizedHeaders[i]!;
      if (aliases.some((alias) => alias.toLowerCase() === header.toLowerCase())) {
        map[key] = i;
        assigned.add(i);
        break;
      }
    }
  }

  const missingRequired = PROMPT_SHEET_REQUIRED_KEYS.filter(
    (column) => map[column] === undefined,
  );

  return { map, missingRequired };
}

export function splitTaxonomyValues(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(PROMPT_SHEET_LIST_DELIMITER)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
