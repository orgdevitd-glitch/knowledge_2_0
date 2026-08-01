"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import type { ContentBlock } from "@/domain/content/blocks";
import { Badge, Button, Link } from "@/components/ui";
import { Stack } from "@/components/layout";
import type { AdminArticleDto } from "@/features/admin/articles/admin-article-dto";
import type { AdminArticleActions, AdminTaxonomyOption } from "@/features/admin/articles/queries";
import { createDefaultBlock } from "@/features/admin/articles/block-factory";
import {
  AdminMutationClientError,
  adminArticlesApi,
} from "@/features/admin/articles/client/admin-articles-api";

import { ConflictAlert } from "../conflict-alert";
import { PublishDialog } from "../publish-dialog";
import { BlockForm } from "./block-form";
import { BlockList } from "./block-list";
import { BlockPalette } from "./block-palette";
import {
  MetadataPanel,
  metadataEquals,
  metadataFromArticle,
  type EditorMetadata,
} from "./metadata-panel";
import { BLOCK_TYPE_LABELS } from "./block-utils";
import styles from "./editor.module.css";

type SaveStatus = "idle" | "saving" | "saved" | "error";

type EditorState = {
  metadata: EditorMetadata;
  savedMetadata: EditorMetadata;
  blocks: ContentBlock[];
  savedBlocks: ContentBlock[];
  revision: number;
  status: AdminArticleDto["status"];
  selectedBlockId: string | null;
  saveStatus: SaveStatus;
  saveError: string | null;
  conflictOpen: boolean;
  paletteOpen: boolean;
};

type EditorAction =
  | { type: "SET_METADATA"; metadata: EditorMetadata }
  | { type: "SET_BLOCKS"; blocks: ContentBlock[] }
  | { type: "SELECT_BLOCK"; id: string | null }
  | { type: "UPDATE_BLOCK"; block: ContentBlock }
  | { type: "ADD_BLOCK"; block: ContentBlock }
  | { type: "SET_SAVE_STATUS"; status: SaveStatus; error?: string | null }
  | { type: "SAVE_METADATA_SUCCESS"; article: AdminArticleDto }
  | { type: "SAVE_BLOCKS_SUCCESS"; article: AdminArticleDto }
  | { type: "LOAD_ARTICLE"; article: AdminArticleDto }
  | { type: "SET_CONFLICT"; open: boolean }
  | { type: "SET_PALETTE"; open: boolean };

function blocksEqual(a: ContentBlock[], b: ContentBlock[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function initState(article: AdminArticleDto): EditorState {
  const metadata = metadataFromArticle(article);
  const blocks = structuredClone(article.blocks);
  return {
    metadata,
    savedMetadata: structuredClone(metadata),
    blocks,
    savedBlocks: structuredClone(blocks),
    revision: article.revision,
    status: article.status,
    selectedBlockId: blocks[0]?.id ?? null,
    saveStatus: "idle",
    saveError: null,
    conflictOpen: false,
    paletteOpen: false,
  };
}

function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "SET_METADATA":
      return { ...state, metadata: action.metadata, saveStatus: "idle" };
    case "SET_BLOCKS":
      return { ...state, blocks: action.blocks, saveStatus: "idle" };
    case "SELECT_BLOCK":
      return { ...state, selectedBlockId: action.id };
    case "UPDATE_BLOCK":
      return {
        ...state,
        blocks: state.blocks.map((b) =>
          b.id === action.block.id ? action.block : b,
        ),
        saveStatus: "idle",
      };
    case "ADD_BLOCK": {
      const blocks = [...state.blocks, action.block];
      return {
        ...state,
        blocks,
        selectedBlockId: action.block.id,
        saveStatus: "idle",
      };
    }
    case "SET_SAVE_STATUS":
      return {
        ...state,
        saveStatus: action.status,
        saveError: action.error ?? null,
      };
    case "SAVE_METADATA_SUCCESS": {
      const metadata = metadataFromArticle(action.article);
      return {
        ...state,
        metadata,
        savedMetadata: structuredClone(metadata),
        revision: action.article.revision,
        status: action.article.status,
        saveStatus: "saved",
        saveError: null,
        conflictOpen: false,
      };
    }
    case "SAVE_BLOCKS_SUCCESS": {
      const blocks = structuredClone(action.article.blocks);
      return {
        ...state,
        blocks,
        savedBlocks: structuredClone(blocks),
        revision: action.article.revision,
        status: action.article.status,
        saveStatus: "saved",
        saveError: null,
        conflictOpen: false,
      };
    }
    case "LOAD_ARTICLE":
      return initState(action.article);
    case "SET_CONFLICT":
      return { ...state, conflictOpen: action.open };
    case "SET_PALETTE":
      return { ...state, paletteOpen: action.open };
    default:
      return state;
  }
}

export type ArticleEditorProps = {
  initialArticle: AdminArticleDto;
  taxonomy: {
    categories: AdminTaxonomyOption[];
    tags: AdminTaxonomyOption[];
    audiences: AdminTaxonomyOption[];
  };
  actions: AdminArticleActions;
};

export function ArticleEditor({
  initialArticle,
  taxonomy,
  actions,
}: ArticleEditorProps) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, initialArticle, initState);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState<string | null>(null);

  const dirtyMetadata = !metadataEquals(state.metadata, state.savedMetadata);
  const dirtyBlocks = !blocksEqual(state.blocks, state.savedBlocks);
  const isDirty = dirtyMetadata || dirtyBlocks;

  const selectedBlock = useMemo(
    () => state.blocks.find((b) => b.id === state.selectedBlockId) ?? null,
    [state.blocks, state.selectedBlockId],
  );

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor?.href) return;
      try {
        const url = new URL(anchor.href);
        if (
          url.origin === window.location.origin &&
          !url.pathname.includes("/edit")
        ) {
          const ok = window.confirm(
            "Есть несохранённые изменения. Продолжить без сохранения?",
          );
          if (!ok) e.preventDefault();
        }
      } catch {
        /* ignore */
      }
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [isDirty]);

  const handleConflict = useCallback((err: unknown) => {
    if (err instanceof AdminMutationClientError && err.code === "CONFLICT") {
      dispatch({ type: "SET_CONFLICT", open: true });
      dispatch({ type: "SET_SAVE_STATUS", status: "error", error: err.message });
      return true;
    }
    return false;
  }, []);

  const saveMetadata = async () => {
    dispatch({ type: "SET_SAVE_STATUS", status: "saving" });
    try {
      const result = await adminArticlesApi.updateMetadata(initialArticle.id, {
        expectedRevision: state.revision,
        title: state.metadata.title.trim(),
        slug: state.metadata.slug.trim(),
        summary: state.metadata.summary.trim() || null,
        categoryIds: state.metadata.categoryIds,
        tagIds: state.metadata.tagIds,
        audienceIds: state.metadata.audienceIds,
        reviewDueAt: state.metadata.reviewDueAt,
      });
      dispatch({ type: "SAVE_METADATA_SUCCESS", article: result.article });
    } catch (err) {
      if (handleConflict(err)) return;
      const msg =
        err instanceof AdminMutationClientError
          ? err.message
          : "Ошибка сохранения";
      dispatch({ type: "SET_SAVE_STATUS", status: "error", error: msg });
    }
  };

  const saveBlocks = async () => {
    dispatch({ type: "SET_SAVE_STATUS", status: "saving" });
    try {
      const result = await adminArticlesApi.updateBlocks(initialArticle.id, {
        expectedRevision: state.revision,
        blocks: state.blocks,
      });
      dispatch({ type: "SAVE_BLOCKS_SUCCESS", article: result.article });
    } catch (err) {
      if (handleConflict(err)) return;
      const msg =
        err instanceof AdminMutationClientError
          ? err.message
          : "Ошибка сохранения блоков";
      dispatch({ type: "SET_SAVE_STATUS", status: "error", error: msg });
    }
  };

  const handlePublish = async (changeSummary: string) => {
    setPublishLoading(true);
    try {
      let revision = state.revision;

      if (dirtyMetadata) {
        const metaResult = await adminArticlesApi.updateMetadata(
          initialArticle.id,
          {
            expectedRevision: revision,
            title: state.metadata.title.trim(),
            slug: state.metadata.slug.trim(),
            summary: state.metadata.summary.trim() || null,
            categoryIds: state.metadata.categoryIds,
            tagIds: state.metadata.tagIds,
            audienceIds: state.metadata.audienceIds,
            reviewDueAt: state.metadata.reviewDueAt,
          },
        );
        dispatch({
          type: "SAVE_METADATA_SUCCESS",
          article: metaResult.article,
        });
        revision = metaResult.article.revision;
      }

      if (dirtyBlocks) {
        const blocksResult = await adminArticlesApi.updateBlocks(
          initialArticle.id,
          {
            expectedRevision: revision,
            blocks: state.blocks,
          },
        );
        dispatch({
          type: "SAVE_BLOCKS_SUCCESS",
          article: blocksResult.article,
        });
        revision = blocksResult.article.revision;
      }

      await adminArticlesApi.publish(initialArticle.id, {
        expectedRevision: revision,
        changeSummary: changeSummary || undefined,
      });
      setPublishOpen(false);
      router.push(`/admin/articles/${initialArticle.id}`);
    } catch (err) {
      if (!handleConflict(err)) {
        const msg =
          err instanceof AdminMutationClientError
            ? err.message
            : "Ошибка публикации";
        window.alert(msg);
      }
    } finally {
      setPublishLoading(false);
    }
  };

  const runStatusAction = async (
    key: string,
    fn: () => Promise<{ article: AdminArticleDto }>,
  ) => {
    setStatusLoading(key);
    try {
      const result = await fn();
      dispatch({ type: "LOAD_ARTICLE", article: result.article });
      router.refresh();
    } catch (err) {
      if (!handleConflict(err)) {
        const msg =
          err instanceof AdminMutationClientError
            ? err.message
            : "Ошибка операции";
        window.alert(msg);
      }
    } finally {
      setStatusLoading(null);
    }
  };

  const statusBadge = () => {
    if (state.conflictOpen) return <Badge tone="warning">Конфликт</Badge>;
    if (state.saveStatus === "saving") return <Badge tone="information">Сохранение…</Badge>;
    if (state.saveStatus === "saved") return <Badge tone="success">Сохранено</Badge>;
    if (state.saveStatus === "error") return <Badge tone="error">Ошибка</Badge>;
    if (isDirty) return <Badge tone="accent">Есть изменения</Badge>;
    return <Badge>{state.status}</Badge>;
  };

  return (
    <div className={styles.workspace}>
      <div className={styles.toolbar}>
        <h1 className={styles.toolbarTitle}>{state.metadata.title || "Без названия"}</h1>
        {statusBadge()}
        <Button
          size="small"
          variant="outline"
          loading={state.saveStatus === "saving" && dirtyMetadata}
          disabled={!dirtyMetadata}
          onClick={saveMetadata}
        >
          Сохранить метаданные
        </Button>
        <Button
          size="small"
          variant="outline"
          loading={state.saveStatus === "saving" && dirtyBlocks}
          disabled={!dirtyBlocks}
          onClick={saveBlocks}
        >
          Сохранить блоки
        </Button>
        <Link href={`/admin/articles/${initialArticle.id}/preview`} variant="subtle">
          Предпросмотр
        </Link>
        {actions.canPublish ? (
          <Button size="small" onClick={() => setPublishOpen(true)}>
            Опубликовать
          </Button>
        ) : null}
        {actions.canHide ? (
          <Button
            size="small"
            variant="outline"
            loading={statusLoading === "hide"}
            onClick={() =>
              runStatusAction("hide", () =>
                adminArticlesApi.hide(initialArticle.id, state.revision),
              )
            }
          >
            Скрыть
          </Button>
        ) : null}
        {actions.canArchive ? (
          <Button
            size="small"
            variant="outline"
            loading={statusLoading === "archive"}
            onClick={() =>
              runStatusAction("archive", () =>
                adminArticlesApi.archive(initialArticle.id, state.revision),
              )
            }
          >
            В архив
          </Button>
        ) : null}
      </div>

      {state.saveError ? (
        <p role="alert" style={{ margin: 0, color: "var(--color-error)" }}>
          {state.saveError}
        </p>
      ) : null}

      {state.conflictOpen ? (
        <ConflictAlert
          onRefresh={() => window.location.reload()}
          onKeepLocal={() => dispatch({ type: "SET_CONFLICT", open: false })}
        />
      ) : null}

      <Stack gap={3}>
        <section className={styles.panel} aria-labelledby="meta-heading">
          <div className={styles.panelHeader}>
            <span id="meta-heading">Метаданные</span>
          </div>
          <div className={styles.panelBody}>
            <MetadataPanel
              metadata={state.metadata}
              taxonomy={taxonomy}
              onChange={(metadata) =>
                dispatch({ type: "SET_METADATA", metadata })
              }
            />
          </div>
        </section>

        <div className={styles.columns}>
          <section className={styles.panel} aria-labelledby="blocks-heading">
            <div className={styles.panelHeader}>
              <span id="blocks-heading">Блоки ({state.blocks.length})</span>
              <Button
                size="small"
                variant="secondary"
                onClick={() => dispatch({ type: "SET_PALETTE", open: true })}
              >
                + Блок
              </Button>
            </div>
            <BlockList
              blocks={state.blocks}
              selectedBlockId={state.selectedBlockId}
              onSelect={(id) => dispatch({ type: "SELECT_BLOCK", id })}
              onReorder={(blocks) => dispatch({ type: "SET_BLOCKS", blocks })}
              onUpdate={(blocks) => {
                dispatch({ type: "SET_BLOCKS", blocks });
                if (
                  state.selectedBlockId &&
                  !blocks.some((b) => b.id === state.selectedBlockId)
                ) {
                  dispatch({
                    type: "SELECT_BLOCK",
                    id: blocks[0]?.id ?? null,
                  });
                }
              }}
            />
          </section>

          <section className={styles.panel} aria-labelledby="props-heading">
            <div className={styles.panelHeader}>
              <span id="props-heading">
                {selectedBlock
                  ? BLOCK_TYPE_LABELS[selectedBlock.type]
                  : "Свойства блока"}
              </span>
            </div>
            <div className={styles.panelBody}>
              {selectedBlock ? (
                <BlockForm
                  block={selectedBlock}
                  onChange={(block) =>
                    dispatch({ type: "UPDATE_BLOCK", block })
                  }
                />
              ) : (
                <p
                  style={{
                    margin: 0,
                    color: "var(--color-text-muted)",
                    fontSize: "0.875rem",
                  }}
                >
                  Выберите блок в списке слева.
                </p>
              )}
            </div>
          </section>
        </div>
      </Stack>

      <BlockPalette
        open={state.paletteOpen}
        onClose={() => dispatch({ type: "SET_PALETTE", open: false })}
        onSelect={(type) => {
          const block = createDefaultBlock(type);
          dispatch({ type: "ADD_BLOCK", block });
        }}
      />

      <PublishDialog
        open={publishOpen}
        loading={publishLoading}
        onConfirm={handlePublish}
        onCancel={() => setPublishOpen(false)}
      />
    </div>
  );
}
