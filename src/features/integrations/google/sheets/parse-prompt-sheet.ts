import type { ImportError, ImportWarning } from "@/domain/integrations/import-job";
import { slugify } from "@/domain/shared/value-objects";
import { GOOGLE_WORKSPACE_LIMITS } from "@/server/google-workspace/limits";
import { GoogleWorkspaceError } from "@/server/google-workspace/errors";

import {
  PORTAL_SCHEMA_SHEET_NAME,
  PROMPT_SHEET_HEADER_ALIASES,
  PROMPT_SHEET_LIST_DELIMITER,
  PROMPT_SHEET_OPTIONAL_KEYS,
  PROMPT_SHEET_REQUIRED_KEYS,
  PROMPT_SHEET_SCHEMA_VERSION,
  type PortalSchemaMarker,
  type PromptSheetColumnKey,
} from "./prompt-sheet-schema";
import {
  resolveTaxonomyTokens,
  type TaxonomyLookupItem,
  type TaxonomyTokenResolution,
} from "./taxonomy-resolution";
import { checksumPromptSheetNormalized } from "./checksum";

export type PromptImportItemStatus =
  | "ready"
  | "warning"
  | "error"
  | "new"
  | "update"
  | "skip";

export type PromptImportItem = {
  rowNumber: number;
  externalId: string;
  title: string;
  proposedSlug: string;
  promptText: string;
  summary: string | null;
  categoryTokens: TaxonomyTokenResolution[];
  tagTokens: TaxonomyTokenResolution[];
  audienceTokens: TaxonomyTokenResolution[];
  inputRequirements: string | null;
  outputRequirements: string | null;
  restrictions: string | null;
  usageExample: string | null;
  reviewDueAt: string | null;
  status: PromptImportItemStatus;
  action: "create" | "update" | "skip";
  existingPromptId: string | null;
  errors: ImportError[];
  warnings: ImportWarning[];
  normalized: Record<string, string>;
};

export type PromptSheetParseResult = {
  schemaVersion: number;
  dataSheet: string;
  headerRow: number;
  headers: string[];
  columnMap: Partial<Record<PromptSheetColumnKey, number>>;
  items: PromptImportItem[];
  warnings: ImportWarning[];
  errors: ImportError[];
  checksum: string;
  metrics: {
    total: number;
    ready: number;
    warning: number;
    error: number;
    create: number;
    update: number;
  };
  marker: PortalSchemaMarker | null;
};

function splitList(value: string): string[] {
  if (!value.trim()) return [];
  return value
    .split(PROMPT_SHEET_LIST_DELIMITER)
    .map((part) => part.trim())
    .filter(Boolean);
}

function resolveHeaderKey(header: string): PromptSheetColumnKey | null {
  const trimmed = header.trim();
  for (const [key, aliases] of Object.entries(PROMPT_SHEET_HEADER_ALIASES) as Array<
    [PromptSheetColumnKey, readonly string[]]
  >) {
    if (aliases.some((alias) => alias === trimmed)) {
      return key;
    }
  }
  return null;
}

export function parsePortalSchemaMarker(
  values: string[][],
): PortalSchemaMarker | null {
  if (!values.length) return null;
  const map = new Map<string, string>();
  for (const row of values) {
    const key = (row[0] ?? "").trim().toLowerCase();
    const value = (row[1] ?? "").trim();
    if (key) map.set(key, value);
  }
  const schemaVersion = Number(map.get("schema_version") ?? "0");
  const contentType = map.get("content_type") ?? "";
  const dataSheet = map.get("data_sheet") ?? "";
  const headerRow = Number(map.get("header_row") ?? "1");
  if (!schemaVersion || !dataSheet) return null;
  return {
    schemaVersion,
    contentType,
    dataSheet,
    headerRow: Number.isFinite(headerRow) && headerRow > 0 ? headerRow : 1,
  };
}

export type ParsePromptSheetInput = {
  spreadsheetId: string;
  dataSheetName: string;
  rows: string[][];
  markerSheetRows?: string[][];
  existingByExternalId?: Map<string, { id: string; slug: string; revision: number }>;
  existingSlugs?: Set<string>;
  categories?: TaxonomyLookupItem[];
  tags?: TaxonomyLookupItem[];
  audiences?: TaxonomyLookupItem[];
};

export function parsePromptSheet(
  input: ParsePromptSheetInput,
): PromptSheetParseResult {
  const warnings: ImportWarning[] = [];
  const errors: ImportError[] = [];

  const marker = input.markerSheetRows
    ? parsePortalSchemaMarker(input.markerSheetRows)
    : null;

  if (!marker) {
    warnings.push({
      code: "SCHEMA_MARKER_MISSING",
      message:
        "Служебный лист _portal_schema не найден; используется ручной выбор листа",
    });
  } else if (marker.schemaVersion !== PROMPT_SHEET_SCHEMA_VERSION) {
    errors.push({
      code: "UNSUPPORTED_SCHEMA_VERSION",
      message: `Неподдерживаемая schema_version: ${marker.schemaVersion}`,
    });
  } else if (
    marker.contentType &&
    marker.contentType !== "prompt" &&
    marker.contentType !== "prompts"
  ) {
    warnings.push({
      code: "CONTENT_TYPE_UNEXPECTED",
      message: `content_type маркера: ${marker.contentType}`,
    });
  }

  const headerRowIndex = Math.max(0, (marker?.headerRow ?? 1) - 1);
  const headerCells = input.rows[headerRowIndex] ?? [];
  if (headerCells.length === 0) {
    throw new GoogleWorkspaceError(
      "GOOGLE_SHEET_SCHEMA_INVALID",
      "Prompt sheet header row is empty",
    );
  }

  if (headerCells.length > GOOGLE_WORKSPACE_LIMITS.MAX_SHEET_COLUMNS) {
    errors.push({
      code: "TOO_MANY_COLUMNS",
      message: "Слишком много колонок в таблице",
    });
  }

  const columnMap: Partial<Record<PromptSheetColumnKey, number>> = {};
  const seenKeys = new Set<PromptSheetColumnKey>();
  const unknownHeaders: string[] = [];

  headerCells.forEach((header, index) => {
    const key = resolveHeaderKey(header);
    if (!key) {
      if (header.trim()) unknownHeaders.push(header.trim());
      return;
    }
    if (seenKeys.has(key)) {
      errors.push({
        code: "DUPLICATE_HEADER",
        message: `Дублирующийся заголовок: ${header}`,
      });
      return;
    }
    seenKeys.add(key);
    columnMap[key] = index;
  });

  for (const required of PROMPT_SHEET_REQUIRED_KEYS) {
    if (columnMap[required] === undefined) {
      errors.push({
        code: "MISSING_REQUIRED_HEADER",
        message: `Отсутствует обязательная колонка: ${required}`,
      });
    }
  }

  if (unknownHeaders.length > 0) {
    warnings.push({
      code: "UNKNOWN_COLUMNS",
      message: "Обнаружены неизвестные колонки",
      context: { headers: unknownHeaders.slice(0, 20) },
    });
  }

  const dataRows = input.rows.slice(headerRowIndex + 1);
  if (dataRows.length > GOOGLE_WORKSPACE_LIMITS.MAX_SHEET_ROWS) {
    errors.push({
      code: "TOO_MANY_ROWS",
      message: "Превышен лимит строк листа",
      context: { max: GOOGLE_WORKSPACE_LIMITS.MAX_SHEET_ROWS },
    });
  }

  const externalIds = new Set<string>();
  const batchSlugs = new Set<string>();
  const items: PromptImportItem[] = [];
  const normalizedRows: Array<Record<string, string>> = [];

  const categories = input.categories ?? [];
  const tags = input.tags ?? [];
  const audiences = input.audiences ?? [];
  const existingByExternalId = input.existingByExternalId ?? new Map();
  const existingSlugs = input.existingSlugs ?? new Set();

  dataRows.forEach((row, offset) => {
    if (items.length >= GOOGLE_WORKSPACE_LIMITS.MAX_SHEET_ROWS) return;
    const rowNumber = headerRowIndex + 2 + offset;
    const cell = (key: PromptSheetColumnKey): string => {
      const idx = columnMap[key];
      if (idx === undefined) return "";
      const raw = row[idx] ?? "";
      return String(raw).slice(0, GOOGLE_WORKSPACE_LIMITS.MAX_CELL_LENGTH);
    };

    const isEmpty = PROMPT_SHEET_REQUIRED_KEYS.every((key) => !cell(key).trim());
    if (isEmpty) return;

    const rowErrors: ImportError[] = [];
    const rowWarnings: ImportWarning[] = [];

    for (const value of row) {
      if (String(value).length > GOOGLE_WORKSPACE_LIMITS.MAX_CELL_LENGTH) {
        rowErrors.push({
          code: "CELL_TOO_LONG",
          message: "Значение ячейки превышает лимит",
        });
        break;
      }
    }

    const externalId = cell("external_id").trim();
    const title = cell("title").trim();
    const promptText = cell("prompt_text").trim();

    if (!externalId) {
      rowErrors.push({
        code: "EMPTY_EXTERNAL_ID",
        message: "external_id обязателен",
      });
    } else if (externalIds.has(externalId)) {
      rowErrors.push({
        code: "DUPLICATE_EXTERNAL_ID",
        message: "Дублирующийся external_id в таблице",
      });
    } else {
      externalIds.add(externalId);
    }

    if (!title) {
      rowErrors.push({ code: "EMPTY_TITLE", message: "title обязателен" });
    }
    if (!promptText) {
      rowErrors.push({
        code: "EMPTY_PROMPT_TEXT",
        message: "prompt_text обязателен",
      });
    }

    let proposedSlug = "";
    try {
      proposedSlug = title ? slugify(title) : "";
    } catch {
      rowErrors.push({
        code: "INVALID_SLUG",
        message: "Не удалось сформировать slug из title",
      });
    }

    if (proposedSlug) {
      if (batchSlugs.has(proposedSlug)) {
        rowErrors.push({
          code: "DUPLICATE_SLUG_BATCH",
          message: "Дублирующийся slug внутри таблицы",
        });
      } else {
        batchSlugs.add(proposedSlug);
      }
    }

    const existing = externalId
      ? existingByExternalId.get(externalId)
      : undefined;

    if (
      proposedSlug &&
      !existing &&
      existingSlugs.has(proposedSlug)
    ) {
      rowErrors.push({
        code: "DUPLICATE_SLUG_FIRESTORE",
        message: "Slug уже используется в портале",
      });
    }

    const categoryTokens = resolveTaxonomyTokens(
      splitList(cell("categories")),
      categories,
    );
    const tagTokens = resolveTaxonomyTokens(splitList(cell("tags")), tags);
    const audienceTokens = resolveTaxonomyTokens(
      splitList(cell("audiences")),
      audiences,
    );

    for (const token of [...categoryTokens, ...tagTokens, ...audienceTokens]) {
      if (token.status === "unresolved") {
        rowWarnings.push({
          code: "TAXONOMY_UNRESOLVED",
          message: `Значение таксономии не найдено: ${token.token}`,
        });
      } else if (token.status === "ambiguous") {
        rowWarnings.push({
          code: "TAXONOMY_AMBIGUOUS",
          message: `Неоднозначное значение таксономии: ${token.token}`,
        });
      } else if (token.status === "archived") {
        rowWarnings.push({
          code: "TAXONOMY_ARCHIVED",
          message: `Архивное значение таксономии: ${token.token}`,
        });
      }
    }

    let reviewDueAt: string | null = cell("review_due_at").trim() || null;
    if (reviewDueAt) {
      const parsed = Date.parse(reviewDueAt);
      if (Number.isNaN(parsed)) {
        rowErrors.push({
          code: "INVALID_REVIEW_DUE_AT",
          message: "Некорректная дата review_due_at",
        });
        reviewDueAt = null;
      } else {
        reviewDueAt = new Date(parsed).toISOString().slice(0, 10);
      }
    }

    const hasTaxonomyBlockers = [...categoryTokens, ...tagTokens, ...audienceTokens].some(
      (t) => t.status === "ambiguous" || t.status === "archived",
    );

    let status: PromptImportItemStatus = "ready";
    if (rowErrors.length > 0 || hasTaxonomyBlockers) {
      status = "error";
    } else if (rowWarnings.length > 0) {
      status = "warning";
    }

    const action: "create" | "update" | "skip" =
      status === "error" ? "skip" : existing ? "update" : "create";

    const normalized: Record<string, string> = {};
    for (const key of [
      ...PROMPT_SHEET_REQUIRED_KEYS,
      ...PROMPT_SHEET_OPTIONAL_KEYS,
    ]) {
      if (columnMap[key] !== undefined) {
        normalized[key] = cell(key);
      }
    }
    normalizedRows.push(normalized);

    items.push({
      rowNumber,
      externalId,
      title,
      proposedSlug,
      promptText,
      summary: cell("summary").trim() || null,
      categoryTokens,
      tagTokens,
      audienceTokens,
      inputRequirements: cell("input_requirements").trim() || null,
      outputRequirements: cell("output_requirements").trim() || null,
      restrictions: cell("restrictions").trim() || null,
      usageExample: cell("usage_example").trim() || null,
      reviewDueAt,
      status,
      action,
      existingPromptId: existing?.id ?? null,
      errors: rowErrors,
      warnings: rowWarnings,
      normalized,
    });
  });

  const metrics = {
    total: items.length,
    ready: items.filter((i) => i.status === "ready").length,
    warning: items.filter((i) => i.status === "warning").length,
    error: items.filter((i) => i.status === "error").length,
    create: items.filter((i) => i.action === "create").length,
    update: items.filter((i) => i.action === "update").length,
  };

  return {
    schemaVersion: marker?.schemaVersion ?? PROMPT_SHEET_SCHEMA_VERSION,
    dataSheet: input.dataSheetName,
    headerRow: headerRowIndex + 1,
    headers: headerCells.map(String),
    columnMap,
    items,
    warnings,
    errors,
    checksum: checksumPromptSheetNormalized({
      schemaVersion: marker?.schemaVersion ?? PROMPT_SHEET_SCHEMA_VERSION,
      headers: headerCells.map(String),
      rows: normalizedRows,
    }),
    metrics,
    marker,
  };
}

export { PORTAL_SCHEMA_SHEET_NAME };
