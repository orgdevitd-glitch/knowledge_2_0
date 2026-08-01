import { BLOCK_SCHEMA_VERSION, type ContentBlock } from "@/domain/content/blocks";
import { parseSourceReference } from "@/domain/content/source";
import type { ImportError, ImportWarning } from "@/domain/integrations/import-job";
import { RICH_TEXT_SCHEMA_VERSION, type RichTextDocument, type RichTextMark, type RichTextNode } from "@/domain/shared/rich-text";
import { slugify } from "@/domain/shared/value-objects";
import { parseSafeUrl } from "@/domain/shared/url";
import { GOOGLE_WORKSPACE_LIMITS } from "@/server/google-workspace/limits";
import type { GoogleDocumentDto } from "@/server/google-workspace/ports";

import type {
  ArticleImportDraft,
  UnsupportedDocElement,
} from "./article-import-draft";
import { checksumArticleImportDraft } from "./checksum";

type NamedStyle =
  | "TITLE"
  | "HEADING_1"
  | "HEADING_2"
  | "HEADING_3"
  | "HEADING_4"
  | "HEADING_5"
  | "HEADING_6"
  | "NORMAL_TEXT"
  | string;

type WarningBucket = Map<string, ImportWarning>;

function addWarning(
  bucket: WarningBucket,
  code: string,
  message: string,
  context?: Record<string, unknown>,
): void {
  if (bucket.size >= GOOGLE_WORKSPACE_LIMITS.MAX_IMPORT_WARNINGS) return;
  const key = `${code}:${message}`;
  if (bucket.has(key)) {
    const existing = bucket.get(key)!;
    const count =
      typeof existing.context?.count === "number" ? existing.context.count : 1;
    bucket.set(key, {
      ...existing,
      context: { ...existing.context, ...context, count: count + 1 },
    });
    return;
  }
  bucket.set(key, { code, message, context });
}

function textFromElements(
  elements: unknown[],
  warnings: WarningBucket,
): { plain: string; rich: RichTextDocument } {
  const nodes: RichTextNode[] = [];
  let plain = "";

  for (const el of elements) {
    if (!el || typeof el !== "object") continue;
    const record = el as Record<string, unknown>;

    if (record.inlineObjectElement) {
      continue;
    }

    if (record.pageBreak) {
      continue;
    }

    if (record.horizontalRule) {
      continue;
    }

    const textRun = record.textRun as
      | { content?: string; textStyle?: Record<string, unknown> }
      | undefined;
    if (!textRun?.content) continue;

    let content = textRun.content.replace(/\r/g, "");
    if (content.endsWith("\n")) {
      content = content.slice(0, -1);
    }
    if (!content) {
      if (textRun.content.includes("\n")) {
        nodes.push({ type: "line-break" });
        plain += "\n";
      }
      continue;
    }

    const style = textRun.textStyle ?? {};
    const marks: RichTextMark[] = [];
    if (style.bold) marks.push({ type: "bold" });
    if (style.italic) marks.push({ type: "italic" });

    const link = style.link as { url?: string } | undefined;
    if (link?.url) {
      try {
        const href = parseSafeUrl(link.url, {
          allowRelative: true,
          requireHttpsAbsolute: false,
        });
        marks.push({ type: "link", href });
      } catch {
        addWarning(
          warnings,
          "UNSAFE_LINK",
          "Небезопасная ссылка преобразована в обычный текст",
        );
      }
    }

    if (
      style.foregroundColor ||
      style.backgroundColor ||
      style.weightedFontFamily ||
      style.fontSize
    ) {
      addWarning(
        warnings,
        "UNSUPPORTED_TEXT_STYLE",
        "Часть визуального оформления текста не импортируется",
      );
    }

    nodes.push({
      type: "text",
      text: content,
      ...(marks.length > 0 ? { marks } : {}),
    });
    plain += content;
  }

  if (nodes.length === 0) {
    nodes.push({ type: "text", text: " " });
  }

  return {
    plain: plain.trim(),
    rich: { schemaVersion: RICH_TEXT_SCHEMA_VERSION, nodes },
  };
}

function makeBlockId(index: number): string {
  return `blk_import_${String(index).padStart(4, "0")}`;
}

function slugifyAnchor(text: string, used: Set<string>): string {
  let base: string;
  try {
    base = slugify(text).slice(0, 80);
  } catch {
    base = `section-${used.size + 1}`;
  }
  let candidate = base;
  let n = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  if (candidate !== base) {
    // caller adds warning
  }
  used.add(candidate);
  return candidate;
}

function listIdFromParagraph(
  paragraph: Record<string, unknown>,
): string | null {
  const bullet = paragraph.bullet as { listId?: string; nestingLevel?: number } | undefined;
  return bullet?.listId ?? null;
}

function nestingLevel(paragraph: Record<string, unknown>): number {
  const bullet = paragraph.bullet as { nestingLevel?: number } | undefined;
  return bullet?.nestingLevel ?? 0;
}

function mapHeadingLevel(
  style: NamedStyle,
  warnings: WarningBucket,
): 2 | 3 | 4 | "title" | "paragraph" {
  switch (style) {
    case "TITLE":
      return "title";
    case "HEADING_1":
      return 2;
    case "HEADING_2":
      return 3;
    case "HEADING_3":
      return 4;
    case "HEADING_4":
    case "HEADING_5":
    case "HEADING_6":
      addWarning(
        warnings,
        "HEADING_DEPTH_CAPPED",
        "Заголовок глубже H3 преобразован в уровень 4",
      );
      return 4;
    default:
      return "paragraph";
  }
}

function parseTable(
  table: Record<string, unknown>,
  position: number,
  warnings: WarningBucket,
  unsupported: UnsupportedDocElement[],
): ContentBlock | null {
  const rowsRaw = (table.tableRows as unknown[]) ?? [];
  if (rowsRaw.length === 0) return null;

  const matrix: string[][] = [];
  let maxCols = 0;
  let merged = false;

  for (const row of rowsRaw) {
    if (!row || typeof row !== "object") continue;
    const cells = ((row as { tableCells?: unknown[] }).tableCells ?? []) as Record<
      string,
      unknown
    >[];
    const values: string[] = [];
    for (const cell of cells) {
      const style = cell.tableCellStyle as
        | { rowSpan?: number; columnSpan?: number }
        | undefined;
      if ((style?.rowSpan ?? 1) > 1 || (style?.columnSpan ?? 1) > 1) {
        merged = true;
      }
      const content = (cell.content as unknown[]) ?? [];
      let text = "";
      for (const structural of content) {
        if (!structural || typeof structural !== "object") continue;
        const paragraph = (structural as { paragraph?: Record<string, unknown> })
          .paragraph;
        if (!paragraph) continue;
        const elements = (paragraph.elements as unknown[]) ?? [];
        text += textFromElements(elements, warnings).plain + " ";
      }
      values.push(text.trim());
    }
    maxCols = Math.max(maxCols, values.length);
    matrix.push(values);
  }

  if (matrix.length === 0 || maxCols === 0) return null;
  if (merged) {
    addWarning(
      warnings,
      "MERGED_CELLS",
      "Объединённые ячейки таблицы упрощены при импорте",
      { position },
    );
  }
  if (matrix.length > GOOGLE_WORKSPACE_LIMITS.MAX_DOC_TABLE_ROWS) {
    unsupported.push({
      kind: "table-too-large",
      position,
      detail: `rows=${matrix.length}`,
    });
    addWarning(
      warnings,
      "TABLE_TOO_LARGE",
      "Таблица слишком большая и не импортирована",
      { position },
    );
    return null;
  }
  if (maxCols > GOOGLE_WORKSPACE_LIMITS.MAX_DOC_TABLE_COLUMNS) {
    unsupported.push({
      kind: "table-too-wide",
      position,
      detail: `cols=${maxCols}`,
    });
    addWarning(
      warnings,
      "TABLE_TOO_WIDE",
      "Таблица слишком широкая и не импортирована",
      { position },
    );
    return null;
  }

  const columns =
    matrix[0]?.map((_, i) => `Колонка ${i + 1}`) ??
    Array.from({ length: maxCols }, (_, i) => `Колонка ${i + 1}`);
  const dataRows = matrix.slice(1).map((row) => {
    const padded = [...row];
    while (padded.length < maxCols) padded.push("");
    return padded.slice(0, maxCols);
  });

  return {
    id: makeBlockId(position),
    type: "table",
    schemaVersion: BLOCK_SCHEMA_VERSION,
    settings: {},
    visibility: "all",
    data: {
      columns: columns.slice(0, maxCols),
      rows: dataRows,
    },
  };
}

export type MapGoogleDocOptions = {
  documentId: string;
  externalUrl?: string;
  modifiedAt?: string | null;
  /** Prefer TITLE paragraph when it differs from document title. */
  preferTitleParagraph?: boolean;
};

/**
 * Maps Google Docs API document DTO into ArticleImportDraft.
 * Page breaks become divider blocks. Multiple tabs: only primary body is mapped;
 * additional tabs are reported as unsupported with a blocking-capable warning.
 */
export function mapGoogleDocToArticleImportDraft(
  document: GoogleDocumentDto,
  options: MapGoogleDocOptions,
): ArticleImportDraft {
  const warnings: WarningBucket = new Map();
  const errors: ImportError[] = [];
  const unsupported: UnsupportedDocElement[] = [];
  const blocks: ContentBlock[] = [];
  const usedAnchors = new Set<string>();
  const titleCandidates: string[] = [];

  const body = document.body ?? {};
  const content = (body.content as unknown[]) ?? [];
  const tabs = (body.tabs as unknown[]) ?? [];
  const tabCount = Array.isArray(tabs) && tabs.length > 0 ? tabs.length : 1;
  if (tabCount > 1) {
    addWarning(
      warnings,
      "MULTIPLE_TABS",
      "Документ содержит несколько вкладок; импортируется только основная",
      { tabCount },
    );
    unsupported.push({
      kind: "additional-tabs",
      position: 0,
      detail: `tabCount=${tabCount}`,
    });
  }

  if (content.length > GOOGLE_WORKSPACE_LIMITS.MAX_DOC_STRUCTURAL_ELEMENTS) {
    errors.push({
      code: "DOCUMENT_TOO_LARGE",
      message: "Документ превышает лимит структурных элементов",
      context: { count: content.length },
    });
  }

  let proposedTitle = (document.title ?? "").trim();
  if (proposedTitle) titleCandidates.push(proposedTitle);

  let textLength = 0;
  let listBuffer: {
    style: "ordered" | "unordered";
    items: string[];
    startIndex: number;
  } | null = null;

  const flushList = () => {
    if (!listBuffer || listBuffer.items.length === 0) {
      listBuffer = null;
      return;
    }
    blocks.push({
      id: makeBlockId(listBuffer.startIndex),
      type: "list",
      schemaVersion: BLOCK_SCHEMA_VERSION,
      settings: {},
      visibility: "all",
      data: {
        style: listBuffer.style,
        items: listBuffer.items.slice(0, 100),
      },
    });
    listBuffer = null;
  };

  content.forEach((structural, index) => {
    if (errors.length > 0) return;
    if (blocks.length >= GOOGLE_WORKSPACE_LIMITS.MAX_DOC_BLOCKS) {
      errors.push({
        code: "TOO_MANY_BLOCKS",
        message: "Превышен лимит блоков статьи",
      });
      return;
    }
    if (!structural || typeof structural !== "object") return;
    const record = structural as Record<string, unknown>;

    if (record.sectionBreak) return;

    if (record.tableOfContents) {
      unsupported.push({ kind: "table-of-contents", position: index });
      addWarning(
        warnings,
        "UNSUPPORTED_TOC",
        "Оглавление Google Docs не импортируется автоматически",
      );
      return;
    }

    if (record.table) {
      flushList();
      const tableBlock = parseTable(
        record.table as Record<string, unknown>,
        index,
        warnings,
        unsupported,
      );
      if (tableBlock) {
        tableBlock.id = makeBlockId(blocks.length + 1);
        blocks.push(tableBlock);
      }
      return;
    }

    if (record.paragraph) {
      const paragraph = record.paragraph as Record<string, unknown>;
      const style =
        ((paragraph.paragraphStyle as { namedStyleType?: string } | undefined)
          ?.namedStyleType as NamedStyle) ?? "NORMAL_TEXT";
      const elements = (paragraph.elements as unknown[]) ?? [];

      const hasInlineObject = elements.some(
        (el) =>
          el &&
          typeof el === "object" &&
          "inlineObjectElement" in (el as object),
      );
      if (hasInlineObject) {
        unsupported.push({ kind: "inline-image", position: index });
        addWarning(
          warnings,
          "INLINE_IMAGE",
          "Встроенные изображения не импортируются (медиатека недоступна). Добавьте вручную позже.",
          { position: index },
        );
      }

      const hasPageBreak = elements.some(
        (el) => el && typeof el === "object" && "pageBreak" in (el as object),
      );
      if (hasPageBreak) {
        flushList();
        blocks.push({
          id: makeBlockId(blocks.length + 1),
          type: "divider",
          schemaVersion: BLOCK_SCHEMA_VERSION,
          settings: {},
          visibility: "all",
          data: {},
        });
        addWarning(
          warnings,
          "PAGE_BREAK",
          "Разрыв страницы преобразован в разделитель",
        );
      }

      const hasHr = elements.some(
        (el) =>
          el && typeof el === "object" && "horizontalRule" in (el as object),
      );
      if (hasHr) {
        flushList();
        blocks.push({
          id: makeBlockId(blocks.length + 1),
          type: "divider",
          schemaVersion: BLOCK_SCHEMA_VERSION,
          settings: {},
          visibility: "all",
          data: {},
        });
      }

      const { plain, rich } = textFromElements(elements, warnings);
      textLength += plain.length;
      if (textLength > GOOGLE_WORKSPACE_LIMITS.MAX_DOC_TEXT_LENGTH) {
        errors.push({
          code: "DOCUMENT_TEXT_TOO_LONG",
          message: "Документ превышает лимит текста",
        });
        return;
      }

      const listId = listIdFromParagraph(paragraph);
      if (listId) {
        const level = nestingLevel(paragraph);
        if (level > 0) {
          addWarning(
            warnings,
            "NESTED_LIST_FLATTENED",
            "Вложенные списки упрощены до одного уровня",
          );
        }
        const styleType =
          style === "NORMAL_TEXT" || !style
            ? "unordered"
            : "unordered";
        // Google list glyph type is in document.lists; default unordered, detect ordered via glyph
        const lists = document.lists ?? {};
        const listDef = lists[listId] as
          | {
              listProperties?: {
                nestingLevels?: Array<{ glyphType?: string }>;
              };
            }
          | undefined;
        const glyph =
          listDef?.listProperties?.nestingLevels?.[0]?.glyphType ?? "";
        const ordered =
          /DECIMAL|ALPHA|ROMAN/i.test(glyph) || glyph.includes("NUMBER");
        const listStyle: "ordered" | "unordered" = ordered
          ? "ordered"
          : "unordered";
        void styleType;

        if (!plain) return;
        if (!listBuffer || listBuffer.style !== listStyle) {
          flushList();
          listBuffer = { style: listStyle, items: [plain], startIndex: index };
        } else {
          listBuffer.items.push(plain);
        }
        return;
      }

      flushList();

      const mapped = mapHeadingLevel(style, warnings);
      if (mapped === "title") {
        if (plain) {
          titleCandidates.push(plain);
          if (!proposedTitle) proposedTitle = plain;
        }
        return;
      }

      if (!plain) return;

      if (mapped === "paragraph") {
        blocks.push({
          id: makeBlockId(blocks.length + 1),
          type: "paragraph",
          schemaVersion: BLOCK_SCHEMA_VERSION,
          settings: {},
          visibility: "all",
          data: { content: rich },
        });
        return;
      }

      const anchor = slugifyAnchor(plain, usedAnchors);
      if (usedAnchors.size > 0 && blocks.some((b) => b.settings.anchor === anchor)) {
        addWarning(
          warnings,
          "DUPLICATE_ANCHOR",
          "Дублирующиеся якоря заголовков нормализованы",
        );
      }
      blocks.push({
        id: makeBlockId(blocks.length + 1),
        type: "heading",
        schemaVersion: BLOCK_SCHEMA_VERSION,
        settings: { anchor },
        visibility: "all",
        data: { level: mapped, text: plain.slice(0, 200) },
      });
      return;
    }

    unsupported.push({ kind: "unknown-structural", position: index });
    addWarning(
      warnings,
      "UNSUPPORTED_ELEMENT",
      "Неподдерживаемый элемент документа пропущен",
      { position: index },
    );
  });

  flushList();

  if (!proposedTitle) {
    proposedTitle = "Импортированная статья";
    addWarning(
      warnings,
      "TITLE_FALLBACK",
      "Заголовок документа пуст; использовано значение по умолчанию",
    );
  }

  if (
    titleCandidates.length >= 2 &&
    titleCandidates[0] !== titleCandidates[1]
  ) {
    addWarning(
      warnings,
      "TITLE_CANDIDATES_DIFFER",
      "Заголовок документа и стиль TITLE различаются — проверьте выбор",
      { candidates: titleCandidates.slice(0, 3) },
    );
    if (options.preferTitleParagraph && titleCandidates[1]) {
      proposedTitle = titleCandidates[1];
    }
  }

  let proposedSlug: string;
  try {
    proposedSlug = slugify(proposedTitle);
  } catch {
    proposedSlug = `import-${options.documentId.slice(0, 12).toLowerCase()}`;
    addWarning(
      warnings,
      "SLUG_FALLBACK",
      "Не удалось сформировать slug из заголовка",
    );
  }

  const proposedSummary = "";

  const sourceReference = parseSourceReference({
    type: "google-docs",
    externalId: options.documentId,
    ...(options.externalUrl ? { externalUrl: options.externalUrl } : {}),
    ...(options.modifiedAt
      ? { lastKnownModifiedAt: options.modifiedAt }
      : {}),
  });

  // Attach checksum into a temporary field via source later by caller
  const draft: ArticleImportDraft = {
    proposedTitle,
    proposedSlug,
    proposedSummary,
    blocks,
    sourceReference,
    warnings: [...warnings.values()],
    errors,
    unsupportedElements: unsupported,
    documentMetadata: {
      documentId: options.documentId,
      documentTitle: document.title ?? "",
      tabCount,
      structuralElementCount: content.length,
      titleCandidates,
    },
  };

  // Ensure checksum is computable (side-effect free)
  void checksumArticleImportDraft(draft);

  return draft;
}
