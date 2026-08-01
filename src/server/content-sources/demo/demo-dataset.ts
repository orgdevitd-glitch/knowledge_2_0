/**
 * DEMO / TEST ONLY — synthetic raw fixtures for Phase 4 public vertical slice.
 *
 * Not production content. Neutral placeholder copy only.
 * Import only from server-side loaders (e.g. load-demo-catalog.ts).
 */

import { BLOCK_SCHEMA_VERSION } from "@/domain/content/blocks";

/** Fixed clock anchor for deterministic demo timestamps. */
export const DEMO_TIMESTAMP = "2024-06-15T12:00:00.000Z" as const;

export const DEMO_OWNER_ID = "demo_user_owner" as const;
export const DEMO_AUTHOR_ID = "demo_user_author" as const;

/** Paragraph blocks store plain text; loader converts via richTextFromPlain. */
export type DemoParagraphData = { plainText: string };

export type DemoRawBlock = {
  id: string;
  type: string;
  schemaVersion: typeof BLOCK_SCHEMA_VERSION;
  settings?: Record<string, unknown>;
  visibility?: "all" | "internal";
  data: Record<string, unknown> | DemoParagraphData;
};

export type DemoRawArticle = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  coverMediaId: string | null;
  categoryIds: string[];
  tagIds: string[];
  audienceIds: string[];
  ownerId: string | null;
  authorId: string | null;
  status: "draft" | "published" | "hidden" | "archived";
  blocks: DemoRawBlock[];
  relatedArticleIds: string[];
  relatedPromptIds: string[];
  relatedVideoIds: string[];
  publishedAt: string | null;
  currentVersion: string | null;
  publishedVersion: string | null;
  revision: number;
};

export type DemoRawPrompt = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  categoryIds: string[];
  tagIds: string[];
  audienceIds: string[];
  promptText: string;
  inputRequirements: string | null;
  outputRequirements: string | null;
  restrictions: string | null;
  usageExample: string | null;
  relatedArticleIds: string[];
  relatedVideoIds: string[];
  ownerId: string | null;
  status: "draft" | "published";
  publishedAt: string | null;
  currentVersion: string | null;
  publishedVersion: string | null;
  revision: number;
};

export type DemoRawCategory = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
};

export type DemoRawTag = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
};

export type DemoRawAudience = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  sortOrder: number;
};

export type DemoRawDataset = {
  categories: DemoRawCategory[];
  tags: DemoRawTag[];
  audiences: DemoRawAudience[];
  prompts: DemoRawPrompt[];
  articles: DemoRawArticle[];
};

const S = BLOCK_SCHEMA_VERSION;
const T = DEMO_TIMESTAMP;

/** DEMO media / entity ids referenced by blocks. */
export const DEMO_MEDIA = {
  cover: "demo_media_cover",
  imageA: "demo_media_img_a",
  imageB: "demo_media_img_b",
  file: "demo_media_file_pdf",
  videoPoster: "demo_media_video_poster",
} as const;

export const DEMO_ENTITY_IDS = {
  categoryRoot: "demo_cat_root",
  categoryGuides: "demo_cat_guides",
  categoryPrompts: "demo_cat_prompts",
  tagStart: "demo_tag_start",
  tagRef: "demo_tag_ref",
  tagTools: "demo_tag_tools",
  audAll: "demo_aud_all",
  audNew: "demo_aud_new",
  audAdv: "demo_aud_adv",
  promptSummarize: "demo_prm_summarize",
  promptOutline: "demo_prm_outline",
  promptReview: "demo_prm_review",
  promptDraft: "demo_prm_draft",
  articleGettingStarted: "demo_art_getting_started",
  articleRelated: "demo_art_related",
  articleQuickRef: "demo_art_quick_ref",
  articleDraft: "demo_art_draft",
  articleHidden: "demo_art_hidden",
  articleArchived: "demo_art_archived",
  videoIntro: "demo_vid_intro",
  versionGettingStarted: "demo_ver_art_getting_1",
  versionRelated: "demo_ver_art_related_1",
  versionQuickRef: "demo_ver_art_quick_1",
  versionPromptSummarize: "demo_ver_prm_summarize_1",
  versionPromptOutline: "demo_ver_prm_outline_1",
  versionPromptReview: "demo_ver_prm_review_1",
} as const;

function blk(
  id: string,
  type: string,
  data: Record<string, unknown> | DemoParagraphData,
  settings?: Record<string, unknown>,
): DemoRawBlock {
  return {
    id,
    type,
    schemaVersion: S,
    settings: settings ?? {},
    visibility: "all",
    data,
  };
}

/** All 22 block types — one block per type for DEMO showcase article. */
const GETTING_STARTED_BLOCKS: DemoRawBlock[] = [
  blk("demo_blk_gs_toc", "table-of-contents", { mode: "auto" }),
  blk("demo_blk_gs_heading", "heading", { level: 2, text: "Начало работы с порталом" }, {
    anchor: "nachalo-raboty",
  }),
  blk("demo_blk_gs_paragraph", "paragraph", {
    plainText: "Краткий обзор возможностей демо-портала знаний.",
  }),
  blk("demo_blk_gs_list", "list", {
    style: "unordered",
    items: ["Поиск материалов", "Просмотр статей", "Копирование промптов"],
  }),
  blk("demo_blk_gs_info", "info", {
    title: "Справка",
    body: "Это демо-контент без реальных корпоративных данных.",
  }),
  blk("demo_blk_gs_tip", "tip", {
    title: "Подсказка",
    body: "Используйте оглавление для быстрой навигации.",
  }),
  blk("demo_blk_gs_warning", "warning", {
    title: "Внимание",
    body: "Не используйте демо-данные в рабочих процессах.",
  }),
  blk("demo_blk_gs_steps", "steps", {
    items: [
      {
        id: "demo_step_open",
        title: "Откройте раздел",
        description: "Выберите категорию в меню.",
      },
      {
        id: "demo_step_read",
        title: "Прочитайте статью",
        description: "Изучите блоки и связанные материалы.",
      },
    ],
  }),
  blk("demo_blk_gs_checklist", "checklist", {
    items: [
      { id: "demo_chk_search", text: "Проверить поиск" },
      { id: "demo_chk_blocks", text: "Просмотреть типы блоков" },
    ],
  }),
  blk("demo_blk_gs_faq", "faq", {
    items: [
      {
        id: "demo_faq_what",
        question: "Что такое демо-каталог?",
        answer: "Набор синтетических материалов для разработки.",
      },
    ],
  }),
  blk("demo_blk_gs_quote", "quote", {
    text: "Хорошая документация экономит время команды.",
    attribution: "Демо-цитата",
  }),
  blk("demo_blk_gs_code", "code", {
    code: 'console.log("demo portal");',
    language: "typescript",
    executable: false,
  }),
  blk("demo_blk_gs_table", "table", {
    columns: ["Раздел", "Описание"],
    rows: [
      ["Статьи", "Инструкции"],
      ["Промпты", "Шаблоны запросов"],
    ],
    caption: "Пример таблицы",
  }),
  blk("demo_blk_gs_image", "image", {
    mediaId: DEMO_MEDIA.imageA,
    alt: "Схема портала",
    decorative: false,
  }),
  blk("demo_blk_gs_gallery", "gallery", {
    items: [
      { mediaId: DEMO_MEDIA.imageA, alt: "Экран списка", decorative: false },
      { mediaId: DEMO_MEDIA.imageB, alt: "Экран статьи", decorative: false },
    ],
  }),
  blk("demo_blk_gs_video", "video", {
    videoId: DEMO_ENTITY_IDS.videoIntro,
    title: "Вводное видео",
    posterMediaId: DEMO_MEDIA.videoPoster,
    autoplay: false,
  }),
  blk("demo_blk_gs_file", "file", {
    mediaId: DEMO_MEDIA.file,
    title: "Чек-лист PDF",
    description: "Демо-файл для скачивания.",
    mimeType: "application/pdf",
  }),
  blk("demo_blk_gs_button", "button", {
    label: "Перейти к материалам",
    href: "/",
    variant: "primary",
    openInNewTab: false,
  }),
  blk("demo_blk_gs_link", "link", {
    label: "Справка",
    href: "https://example.com/help",
    linkType: "external",
  }),
  blk("demo_blk_gs_prompt", "prompt", {
    promptId: DEMO_ENTITY_IDS.promptSummarize,
    showTitle: true,
    showCopyButton: true,
  }),
  blk("demo_blk_gs_related", "related-content", {
    items: [
      { entityType: "article", entityId: DEMO_ENTITY_IDS.articleRelated },
      { entityType: "prompt", entityId: DEMO_ENTITY_IDS.promptOutline },
    ],
  }),
  blk("demo_blk_gs_divider", "divider", {}),
];

/** DEMO raw dataset — serializable plain objects only. */
export const DEMO_RAW_DATASET: DemoRawDataset = {
  categories: [
    {
      id: DEMO_ENTITY_IDS.categoryRoot,
      slug: "demo-knowledge-base",
      title: "База знаний",
      description: "Корневая демо-категория.",
      parentId: null,
      sortOrder: 0,
    },
    {
      id: DEMO_ENTITY_IDS.categoryGuides,
      slug: "demo-guides",
      title: "Руководства",
      description: "Демо-инструкции и гайды.",
      parentId: DEMO_ENTITY_IDS.categoryRoot,
      sortOrder: 1,
    },
    {
      id: DEMO_ENTITY_IDS.categoryPrompts,
      slug: "demo-prompts",
      title: "Промпты",
      description: "Демо-библиотека промптов.",
      parentId: DEMO_ENTITY_IDS.categoryRoot,
      sortOrder: 2,
    },
  ],
  tags: [
    {
      id: DEMO_ENTITY_IDS.tagStart,
      slug: "demo-onboarding",
      title: "Онбординг",
      description: "Материалы для начала.",
    },
    {
      id: DEMO_ENTITY_IDS.tagRef,
      slug: "demo-reference",
      title: "Справка",
      description: "Справочные материалы.",
    },
    {
      id: DEMO_ENTITY_IDS.tagTools,
      slug: "demo-tools",
      title: "Инструменты",
      description: "Рабочие шаблоны.",
    },
  ],
  audiences: [
    {
      id: DEMO_ENTITY_IDS.audAll,
      slug: "demo-all-staff",
      title: "Все сотрудники",
      description: "Общая аудитория.",
      sortOrder: 0,
    },
    {
      id: DEMO_ENTITY_IDS.audNew,
      slug: "demo-newcomers",
      title: "Новые сотрудники",
      description: "Первые недели работы.",
      sortOrder: 1,
    },
    {
      id: DEMO_ENTITY_IDS.audAdv,
      slug: "demo-advanced",
      title: "Опытные пользователи",
      description: "Расширенные сценарии.",
      sortOrder: 2,
    },
  ],
  prompts: [
    {
      id: DEMO_ENTITY_IDS.promptSummarize,
      slug: "demo-summarize-text",
      title: "Сжать текст",
      summary: "Краткое резюме длинного фрагмента.",
      categoryIds: [DEMO_ENTITY_IDS.categoryPrompts],
      tagIds: [DEMO_ENTITY_IDS.tagTools],
      audienceIds: [DEMO_ENTITY_IDS.audAll],
      promptText:
        "Сожми следующий текст до 3 предложений, сохранив ключевые факты:\n\n{{text}}",
      inputRequirements: "Исходный текст до 5000 символов.",
      outputRequirements: "Три предложения на русском языке.",
      restrictions: "Без выдуманных фактов.",
      usageExample: "Вставьте абзац отчёта вместо {{text}}.",
      relatedArticleIds: [DEMO_ENTITY_IDS.articleGettingStarted],
      relatedVideoIds: [],
      ownerId: DEMO_OWNER_ID,
      status: "published",
      publishedAt: T,
      currentVersion: DEMO_ENTITY_IDS.versionPromptSummarize,
      publishedVersion: DEMO_ENTITY_IDS.versionPromptSummarize,
      revision: 1,
    },
    {
      id: DEMO_ENTITY_IDS.promptOutline,
      slug: "demo-outline-article",
      title: "План статьи",
      summary: "Черновой план материала.",
      categoryIds: [DEMO_ENTITY_IDS.categoryPrompts],
      tagIds: [DEMO_ENTITY_IDS.tagRef],
      audienceIds: [DEMO_ENTITY_IDS.audAdv],
      promptText:
        "Составь план статьи на тему «{{topic}}» из 5 разделов с подзаголовками.",
      inputRequirements: "Тема в одном предложении.",
      outputRequirements: "Маркированный список разделов.",
      restrictions: null,
      usageExample: null,
      relatedArticleIds: [DEMO_ENTITY_IDS.articleRelated],
      relatedVideoIds: [],
      ownerId: DEMO_OWNER_ID,
      status: "published",
      publishedAt: T,
      currentVersion: DEMO_ENTITY_IDS.versionPromptOutline,
      publishedVersion: DEMO_ENTITY_IDS.versionPromptOutline,
      revision: 1,
    },
    {
      id: DEMO_ENTITY_IDS.promptReview,
      slug: "demo-review-checklist",
      title: "Проверка текста",
      summary: "Быстрая вычитка черновика.",
      categoryIds: [DEMO_ENTITY_IDS.categoryPrompts],
      tagIds: [DEMO_ENTITY_IDS.tagTools, DEMO_ENTITY_IDS.tagRef],
      audienceIds: [DEMO_ENTITY_IDS.audAll],
      promptText:
        "Проверь текст на ясность и опечатки. Верни список замечаний:\n\n{{draft}}",
      inputRequirements: null,
      outputRequirements: "Список замечаний.",
      restrictions: null,
      usageExample: null,
      relatedArticleIds: [],
      relatedVideoIds: [],
      ownerId: DEMO_OWNER_ID,
      status: "published",
      publishedAt: T,
      currentVersion: DEMO_ENTITY_IDS.versionPromptReview,
      publishedVersion: DEMO_ENTITY_IDS.versionPromptReview,
      revision: 1,
    },
    {
      id: DEMO_ENTITY_IDS.promptDraft,
      slug: "demo-draft-prompt",
      title: "Черновой промпт",
      summary: "Незавершённый шаблон.",
      categoryIds: [DEMO_ENTITY_IDS.categoryPrompts],
      tagIds: [],
      audienceIds: [],
      promptText: "Черновик: сформулируй вопрос по теме {{topic}}.",
      inputRequirements: null,
      outputRequirements: null,
      restrictions: null,
      usageExample: null,
      relatedArticleIds: [],
      relatedVideoIds: [],
      ownerId: null,
      status: "draft",
      publishedAt: null,
      currentVersion: null,
      publishedVersion: null,
      revision: 0,
    },
  ],
  articles: [
    {
      id: DEMO_ENTITY_IDS.articleGettingStarted,
      slug: "getting-started-portal",
      title: "Начало работы с порталом",
      summary: "Обзор демо-портала и всех типов контент-блоков.",
      coverMediaId: DEMO_MEDIA.cover,
      categoryIds: [DEMO_ENTITY_IDS.categoryGuides],
      tagIds: [DEMO_ENTITY_IDS.tagStart],
      audienceIds: [DEMO_ENTITY_IDS.audNew, DEMO_ENTITY_IDS.audAll],
      ownerId: DEMO_OWNER_ID,
      authorId: DEMO_AUTHOR_ID,
      status: "published",
      blocks: GETTING_STARTED_BLOCKS,
      relatedArticleIds: [DEMO_ENTITY_IDS.articleRelated],
      relatedPromptIds: [DEMO_ENTITY_IDS.promptSummarize],
      relatedVideoIds: [],
      publishedAt: T,
      currentVersion: DEMO_ENTITY_IDS.versionGettingStarted,
      publishedVersion: DEMO_ENTITY_IDS.versionGettingStarted,
      revision: 1,
    },
    {
      id: DEMO_ENTITY_IDS.articleRelated,
      slug: "related-materials",
      title: "Связанные материалы",
      summary: "Пример перекрёстных ссылок между статьями и промптами.",
      coverMediaId: null,
      categoryIds: [DEMO_ENTITY_IDS.categoryGuides],
      tagIds: [DEMO_ENTITY_IDS.tagRef],
      audienceIds: [DEMO_ENTITY_IDS.audAll],
      ownerId: DEMO_OWNER_ID,
      authorId: DEMO_AUTHOR_ID,
      status: "published",
      blocks: [
        blk("demo_blk_rel_heading", "heading", {
          level: 2,
          text: "Связанные материалы",
        }),
        blk("demo_blk_rel_paragraph", "paragraph", {
          plainText: "Ниже — блок связанного контента и метаданные ссылок.",
        }),
        blk("demo_blk_rel_related", "related-content", {
          items: [
            {
              entityType: "article",
              entityId: DEMO_ENTITY_IDS.articleGettingStarted,
            },
            {
              entityType: "article",
              entityId: DEMO_ENTITY_IDS.articleQuickRef,
            },
            {
              entityType: "prompt",
              entityId: DEMO_ENTITY_IDS.promptReview,
            },
            {
              entityType: "prompt",
              entityId: DEMO_ENTITY_IDS.promptOutline,
            },
          ],
        }),
      ],
      relatedArticleIds: [
        DEMO_ENTITY_IDS.articleGettingStarted,
        DEMO_ENTITY_IDS.articleQuickRef,
      ],
      relatedPromptIds: [
        DEMO_ENTITY_IDS.promptReview,
        DEMO_ENTITY_IDS.promptOutline,
      ],
      relatedVideoIds: [],
      publishedAt: T,
      currentVersion: DEMO_ENTITY_IDS.versionRelated,
      publishedVersion: DEMO_ENTITY_IDS.versionRelated,
      revision: 1,
    },
    {
      id: DEMO_ENTITY_IDS.articleQuickRef,
      slug: "quick-reference",
      title: "Краткая справка",
      summary: "Компактная опубликованная статья.",
      coverMediaId: null,
      categoryIds: [DEMO_ENTITY_IDS.categoryGuides],
      tagIds: [DEMO_ENTITY_IDS.tagRef],
      audienceIds: [DEMO_ENTITY_IDS.audAll],
      ownerId: DEMO_OWNER_ID,
      authorId: DEMO_AUTHOR_ID,
      status: "published",
      blocks: [
        blk("demo_blk_qr_heading", "heading", {
          level: 3,
          text: "Краткая справка",
        }),
        blk("demo_blk_qr_paragraph", "paragraph", {
          plainText: "Минимальная опубликованная статья для навигации.",
        }),
      ],
      relatedArticleIds: [],
      relatedPromptIds: [],
      relatedVideoIds: [],
      publishedAt: T,
      currentVersion: DEMO_ENTITY_IDS.versionQuickRef,
      publishedVersion: DEMO_ENTITY_IDS.versionQuickRef,
      revision: 1,
    },
    {
      id: DEMO_ENTITY_IDS.articleDraft,
      slug: "draft-guide",
      title: "Черновик руководства",
      summary: "Незавершённый материал.",
      coverMediaId: null,
      categoryIds: [DEMO_ENTITY_IDS.categoryGuides],
      tagIds: [],
      audienceIds: [],
      ownerId: null,
      authorId: DEMO_AUTHOR_ID,
      status: "draft",
      blocks: [
        blk("demo_blk_draft_paragraph", "paragraph", {
          plainText: "Черновик — публикация ещё не выполнена.",
        }),
      ],
      relatedArticleIds: [],
      relatedPromptIds: [],
      relatedVideoIds: [],
      publishedAt: null,
      currentVersion: null,
      publishedVersion: null,
      revision: 0,
    },
    {
      id: DEMO_ENTITY_IDS.articleHidden,
      slug: "hidden-guide",
      title: "Скрытое руководство",
      summary: "Материал со статусом hidden.",
      coverMediaId: null,
      categoryIds: [DEMO_ENTITY_IDS.categoryGuides],
      tagIds: [DEMO_ENTITY_IDS.tagStart],
      audienceIds: [DEMO_ENTITY_IDS.audAdv],
      ownerId: DEMO_OWNER_ID,
      authorId: DEMO_AUTHOR_ID,
      status: "hidden",
      blocks: [
        blk("demo_blk_hidden_paragraph", "paragraph", {
          plainText: "Скрытый демо-материал, недоступный публично.",
        }),
      ],
      relatedArticleIds: [],
      relatedPromptIds: [],
      relatedVideoIds: [],
      publishedAt: null,
      currentVersion: null,
      publishedVersion: null,
      revision: 1,
    },
    {
      id: DEMO_ENTITY_IDS.articleArchived,
      slug: "archived-guide",
      title: "Архивное руководство",
      summary: "Устаревший демо-материал.",
      coverMediaId: null,
      categoryIds: [DEMO_ENTITY_IDS.categoryGuides],
      tagIds: [DEMO_ENTITY_IDS.tagRef],
      audienceIds: [DEMO_ENTITY_IDS.audAll],
      ownerId: DEMO_OWNER_ID,
      authorId: DEMO_AUTHOR_ID,
      status: "archived",
      blocks: [
        blk("demo_blk_archived_paragraph", "paragraph", {
          plainText: "Архивная статья для проверки фильтрации статусов.",
        }),
      ],
      relatedArticleIds: [],
      relatedPromptIds: [],
      relatedVideoIds: [],
      publishedAt: T,
      currentVersion: null,
      publishedVersion: null,
      revision: 2,
    },
  ],
};
