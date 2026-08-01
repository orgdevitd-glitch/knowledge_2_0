import {
  BLOCK_SCHEMA_VERSION,
  type BlockType,
  type ContentBlock,
} from "@/domain/content/blocks";
import { richTextFromPlain } from "@/domain/shared/rich-text";

function newId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rand}`;
}

/** Create an initial block for the editor (may fail publish until filled). */
export function createDefaultBlock(type: BlockType): ContentBlock {
  const id = newId("blk");
  const base = {
    id,
    schemaVersion: BLOCK_SCHEMA_VERSION,
    settings: {},
    visibility: "all" as const,
  };

  switch (type) {
    case "heading":
      return { ...base, type, data: { level: 2 as const, text: "Заголовок" } };
    case "paragraph":
      return {
        ...base,
        type,
        data: { content: richTextFromPlain("Текст абзаца") },
      };
    case "list":
      return {
        ...base,
        type,
        data: { style: "unordered" as const, items: ["Пункт 1"] },
      };
    case "table":
      return {
        ...base,
        type,
        data: {
          columns: ["Колонка 1", "Колонка 2"],
          rows: [["", ""]],
        },
      };
    case "quote":
      return {
        ...base,
        type,
        data: { text: "Цитата", attribution: "" },
      };
    case "info":
    case "warning":
    case "tip":
      return {
        ...base,
        type,
        data: { title: "", body: "Текст" },
      };
    case "steps":
      return {
        ...base,
        type,
        data: {
          items: [
            {
              id: newId("step"),
              title: "Шаг 1",
              description: "Описание шага",
            },
          ],
        },
      };
    case "checklist":
      return {
        ...base,
        type,
        data: {
          items: [{ id: newId("chk"), text: "Пункт" }],
        },
      };
    case "faq":
      return {
        ...base,
        type,
        data: {
          items: [
            {
              id: newId("faq"),
              question: "Вопрос?",
              answer: "Ответ",
            },
          ],
        },
      };
    case "prompt":
      return {
        ...base,
        type,
        data: {
          promptId: "prompt_pending",
          showTitle: true,
          showCopyButton: true,
        },
      };
    case "code":
      return {
        ...base,
        type,
        data: { language: "text", code: "// code", filename: "", executable: false as const },
      };
    case "related-content":
      return {
        ...base,
        type,
        data: {
          items: [
            { entityType: "article" as const, entityId: "article_pending" },
          ],
        },
      };
    case "divider":
      return { ...base, type, data: {} };
    case "table-of-contents":
      return { ...base, type, data: { mode: "auto" as const } };
    case "button":
      return {
        ...base,
        type,
        data: {
          label: "Кнопка",
          href: "/",
          variant: "primary" as const,
          openInNewTab: false,
        },
      };
    case "link":
      return {
        ...base,
        type,
        data: {
          label: "Ссылка",
          href: "/",
          linkType: "internal" as const,
        },
      };
    case "image":
      return {
        ...base,
        type,
        data: {
          mediaId: "media_pending",
          alt: "",
          caption: "",
          decorative: true,
        },
      };
    case "gallery":
      return {
        ...base,
        type,
        data: {
          items: [
            { mediaId: "media_pending_a", alt: "", decorative: true },
            { mediaId: "media_pending_b", alt: "", decorative: true },
          ],
        },
      };
    case "video":
      return {
        ...base,
        type,
        data: {
          title: "Видео",
          autoplay: false as const,
        },
      };
    case "file":
      return {
        ...base,
        type,
        data: {
          mediaId: "media_pending",
          title: "Файл",
        },
      };
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

export function duplicateBlock(block: ContentBlock): ContentBlock {
  const clone = structuredClone(block) as ContentBlock;
  clone.id = newId("blk");
  if (clone.type === "steps") {
    clone.data.items = clone.data.items.map((item) => ({
      ...item,
      id: newId("step"),
    }));
  }
  if (clone.type === "checklist") {
    clone.data.items = clone.data.items.map((item) => ({
      ...item,
      id: newId("chk"),
    }));
  }
  if (clone.type === "faq") {
    clone.data.items = clone.data.items.map((item) => ({
      ...item,
      id: newId("faq"),
    }));
  }
  return clone;
}

export const BLOCK_PALETTE_GROUPS: Array<{
  id: string;
  title: string;
  items: Array<{ type: BlockType; title: string; description: string }>;
}> = [
  {
    id: "text",
    title: "Текст",
    items: [
      { type: "heading", title: "Заголовок", description: "H2–H4" },
      { type: "paragraph", title: "Абзац", description: "Основной текст" },
      { type: "list", title: "Список", description: "Маркированный или нумерованный" },
      { type: "quote", title: "Цитата", description: "Выделенная цитата" },
      { type: "code", title: "Код", description: "Фрагмент кода" },
    ],
  },
  {
    id: "structure",
    title: "Структура",
    items: [
      { type: "divider", title: "Разделитель", description: "Горизонтальная линия" },
      {
        type: "table-of-contents",
        title: "Оглавление",
        description: "Автоматическое содержание",
      },
      { type: "table", title: "Таблица", description: "Строки и колонки" },
      { type: "steps", title: "Шаги", description: "Пошаговая инструкция" },
    ],
  },
  {
    id: "info",
    title: "Информация",
    items: [
      { type: "info", title: "Инфо", description: "Информационный блок" },
      { type: "warning", title: "Предупреждение", description: "Важное предупреждение" },
      { type: "tip", title: "Совет", description: "Подсказка" },
      { type: "faq", title: "FAQ", description: "Вопрос и ответ" },
      { type: "checklist", title: "Чеклист", description: "Список проверок" },
    ],
  },
  {
    id: "interactive",
    title: "Интерактивные элементы",
    items: [
      { type: "button", title: "Кнопка", description: "CTA-кнопка" },
      { type: "link", title: "Ссылка", description: "Текстовая ссылка" },
      { type: "prompt", title: "Промт", description: "Ссылка на библиотеку промтов" },
    ],
  },
  {
    id: "related",
    title: "Связанные материалы",
    items: [
      {
        type: "related-content",
        title: "Связанный контент",
        description: "Ссылки на статьи и материалы",
      },
    ],
  },
  {
    id: "media",
    title: "Медиа",
    items: [
      { type: "image", title: "Изображение", description: "Медиатека позже" },
      { type: "gallery", title: "Галерея", description: "Медиатека позже" },
      { type: "video", title: "Видео", description: "Медиатека позже" },
      { type: "file", title: "Файл", description: "Медиатека позже" },
    ],
  },
];
