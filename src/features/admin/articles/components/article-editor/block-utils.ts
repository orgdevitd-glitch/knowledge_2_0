import type { BlockType, ContentBlock } from "@/domain/content/blocks";
import { richTextToPlain } from "@/domain/shared/rich-text";

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  heading: "Заголовок",
  paragraph: "Абзац",
  list: "Список",
  table: "Таблица",
  image: "Изображение",
  gallery: "Галерея",
  video: "Видео",
  file: "Файл",
  button: "Кнопка",
  link: "Ссылка",
  quote: "Цитата",
  info: "Инфо",
  warning: "Предупреждение",
  tip: "Совет",
  steps: "Шаги",
  checklist: "Чеклист",
  faq: "FAQ",
  prompt: "Промт",
  code: "Код",
  "related-content": "Связанный контент",
  divider: "Разделитель",
  "table-of-contents": "Оглавление",
};

export function blockPreviewText(block: ContentBlock): string {
  switch (block.type) {
    case "heading":
      return block.data.text;
    case "paragraph":
      return richTextToPlain(block.data.content).slice(0, 80);
    case "list":
      return block.data.items.join(", ").slice(0, 80);
    case "table":
      return block.data.columns.join(" · ");
    case "quote":
      return block.data.text.slice(0, 80);
    case "info":
    case "warning":
    case "tip":
      return block.data.body.slice(0, 80);
    case "steps":
      return block.data.items.map((i) => i.title).join(" → ");
    case "checklist":
      return block.data.items.map((i) => i.text).join(", ").slice(0, 80);
    case "faq":
      return block.data.items.map((i) => i.question).join(" · ").slice(0, 80);
    case "prompt":
      return block.data.promptId;
    case "code":
      return block.data.filename || block.data.language;
    case "related-content":
      return `${block.data.items.length} ссылок`;
    case "divider":
      return "—";
    case "table-of-contents":
      return block.data.mode === "auto" ? "Авто" : `${block.data.anchors.length} якорей`;
    case "button":
      return block.data.label;
    case "link":
      return block.data.label;
    case "image":
      return block.data.alt || block.data.mediaId;
    case "gallery":
      return `${block.data.items.length} изображений`;
    case "video":
      return block.data.title;
    case "file":
      return block.data.title;
    default: {
      const _exhaustive: never = block;
      return String(_exhaustive);
    }
  }
}

export function blockHasContent(block: ContentBlock): boolean {
  switch (block.type) {
    case "divider":
      return false;
    case "table-of-contents":
      return block.data.mode === "anchors" && block.data.anchors.length > 0;
    case "paragraph": {
      const text = richTextToPlain(block.data.content).trim();
      return text.length > 0 && text !== "Текст абзаца";
    }
    case "heading":
      return block.data.text.trim() !== "Заголовок";
    case "list":
      return block.data.items.some((i) => i.trim() && i !== "Пункт 1");
    case "table":
      return block.data.rows.some((row) => row.some((c) => c.trim()));
    case "quote":
      return block.data.text.trim() !== "Цитата";
    case "info":
    case "warning":
    case "tip":
      return block.data.body.trim() !== "Текст";
    case "steps":
      return block.data.items.some(
        (i) => i.title !== "Шаг 1" || i.description !== "Описание шага",
      );
    case "checklist":
      return block.data.items.some((i) => i.text.trim() !== "Пункт");
    case "faq":
      return block.data.items.some(
        (i) => i.question !== "Вопрос?" || i.answer !== "Ответ",
      );
    case "prompt":
      return !block.data.promptId.includes("pending");
    case "code":
      return block.data.code.trim() !== "// code";
    case "related-content":
      return !block.data.items.every((i) => i.entityId.includes("pending"));
    case "button":
      return block.data.label !== "Кнопка" || block.data.href !== "/";
    case "link":
      return block.data.label !== "Ссылка" || block.data.href !== "/";
    case "image":
    case "file":
      return !block.data.mediaId.includes("pending");
    case "gallery":
      return !block.data.items.every((i) => i.mediaId.includes("pending"));
    case "video":
      return Boolean(block.data.mediaId || block.data.videoId);
    default: {
      const _exhaustive: never = block;
      return Boolean(_exhaustive);
    }
  }
}

function newItemId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}_${rand}`;
}

export { newItemId };
