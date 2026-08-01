"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { Badge, Button, Checkbox, Input, Link, SearchField, Textarea } from "@/components/ui";
import { Stack } from "@/components/layout";
import type { AdminPromptDto } from "@/features/admin/prompts/admin-prompt-dto";
import type {
  AdminPromptActions,
  AdminTaxonomyOption,
} from "@/features/admin/prompts/queries";
import {
  AdminMutationClientError,
  adminPromptsApi,
} from "@/features/admin/prompts/client/admin-prompts-api";
import { ConflictAlert } from "@/features/admin/articles/components/conflict-alert";

import { PromptPublishDialog } from "./prompt-publish-dialog";

export type EditorPromptFields = {
  title: string;
  slug: string;
  summary: string;
  promptText: string;
  inputRequirements: string;
  outputRequirements: string;
  restrictions: string;
  usageExample: string;
  categoryIds: string[];
  tagIds: string[];
  audienceIds: string[];
  reviewDueAt: string | null;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

type EditorState = {
  fields: EditorPromptFields;
  savedFields: EditorPromptFields;
  revision: number;
  status: AdminPromptDto["status"];
  saveStatus: SaveStatus;
  saveError: string | null;
  conflictOpen: boolean;
};

type EditorAction =
  | { type: "SET_FIELDS"; fields: EditorPromptFields }
  | { type: "SET_SAVE_STATUS"; status: SaveStatus; error?: string | null }
  | { type: "SAVE_SUCCESS"; prompt: AdminPromptDto }
  | { type: "LOAD_PROMPT"; prompt: AdminPromptDto }
  | { type: "SET_CONFLICT"; open: boolean };

function reviewDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function reviewDateToIso(dateStr: string): string | null {
  if (!dateStr.trim()) return null;
  return `${dateStr}T12:00:00.000Z`;
}

export function fieldsFromPrompt(prompt: AdminPromptDto): EditorPromptFields {
  return {
    title: prompt.title,
    slug: prompt.slug,
    summary: prompt.summary ?? "",
    promptText: prompt.promptText,
    inputRequirements: prompt.inputRequirements ?? "",
    outputRequirements: prompt.outputRequirements ?? "",
    restrictions: prompt.restrictions ?? "",
    usageExample: prompt.usageExample ?? "",
    categoryIds: [...prompt.categoryIds],
    tagIds: [...prompt.tagIds],
    audienceIds: [...prompt.audienceIds],
    reviewDueAt: prompt.reviewDueAt,
  };
}

function fieldsEqual(a: EditorPromptFields, b: EditorPromptFields): boolean {
  return (
    a.title === b.title &&
    a.slug === b.slug &&
    a.summary === b.summary &&
    a.promptText === b.promptText &&
    a.inputRequirements === b.inputRequirements &&
    a.outputRequirements === b.outputRequirements &&
    a.restrictions === b.restrictions &&
    a.usageExample === b.usageExample &&
    a.reviewDueAt === b.reviewDueAt &&
    a.categoryIds.join() === b.categoryIds.join() &&
    a.tagIds.join() === b.tagIds.join() &&
    a.audienceIds.join() === b.audienceIds.join()
  );
}

function initState(prompt: AdminPromptDto): EditorState {
  const fields = fieldsFromPrompt(prompt);
  return {
    fields,
    savedFields: structuredClone(fields),
    revision: prompt.revision,
    status: prompt.status,
    saveStatus: "idle",
    saveError: null,
    conflictOpen: false,
  };
}

function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "SET_FIELDS":
      return { ...state, fields: action.fields, saveStatus: "idle" };
    case "SET_SAVE_STATUS":
      return {
        ...state,
        saveStatus: action.status,
        saveError: action.error ?? null,
      };
    case "SAVE_SUCCESS": {
      const fields = fieldsFromPrompt(action.prompt);
      return {
        ...state,
        fields,
        savedFields: structuredClone(fields),
        revision: action.prompt.revision,
        status: action.prompt.status,
        saveStatus: "saved",
        saveError: null,
        conflictOpen: false,
      };
    }
    case "LOAD_PROMPT":
      return initState(action.prompt);
    case "SET_CONFLICT":
      return { ...state, conflictOpen: action.open };
    default:
      return state;
  }
}

function TaxonomyField({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: AdminTaxonomyOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.title.toLowerCase().includes(q) ||
        o.slug.toLowerCase().includes(q),
    );
  }, [options, query]);

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <fieldset style={{ border: "none", margin: 0, padding: 0 }}>
      <legend style={{ fontWeight: 600, marginBottom: "0.375rem", fontSize: "0.875rem" }}>
        {label}
      </legend>
      <SearchField
        label={`Поиск: ${label}`}
        hideLabel
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onClear={() => setQuery("")}
        placeholder="Поиск…"
      />
      <Stack gap={1} style={{ marginTop: "0.375rem", maxHeight: "8rem", overflowY: "auto" }}>
        {filtered.map((opt) => {
          const isArchived = opt.status === "archived";
          const isSelected = selected.includes(opt.id);
          if (isArchived && !isSelected) return null;
          return (
            <Checkbox
              key={opt.id}
              label={isArchived ? `${opt.title} (архив)` : opt.title}
              checked={isSelected}
              onChange={() => toggle(opt.id)}
            />
          );
        })}
      </Stack>
    </fieldset>
  );
}

export type PromptEditorProps = {
  initialPrompt: AdminPromptDto;
  taxonomy: {
    categories: AdminTaxonomyOption[];
    tags: AdminTaxonomyOption[];
    audiences: AdminTaxonomyOption[];
  };
  actions: AdminPromptActions;
};

export function PromptEditor({
  initialPrompt,
  taxonomy,
  actions,
}: PromptEditorProps) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, initialPrompt, initState);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState<string | null>(null);

  const isDirty = !fieldsEqual(state.fields, state.savedFields);

  const patch = (partial: Partial<EditorPromptFields>) => {
    dispatch({ type: "SET_FIELDS", fields: { ...state.fields, ...partial } });
  };

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

  const buildPatchBody = (revision: number) => ({
    expectedRevision: revision,
    title: state.fields.title.trim(),
    slug: state.fields.slug.trim(),
    summary: state.fields.summary.trim() || null,
    promptText: state.fields.promptText.trim(),
    inputRequirements: state.fields.inputRequirements.trim() || null,
    outputRequirements: state.fields.outputRequirements.trim() || null,
    restrictions: state.fields.restrictions.trim() || null,
    usageExample: state.fields.usageExample.trim() || null,
    categoryIds: state.fields.categoryIds,
    tagIds: state.fields.tagIds,
    audienceIds: state.fields.audienceIds,
    reviewDueAt: state.fields.reviewDueAt,
  });

  const save = async () => {
    dispatch({ type: "SET_SAVE_STATUS", status: "saving" });
    try {
      const result = await adminPromptsApi.update(
        initialPrompt.id,
        buildPatchBody(state.revision),
      );
      dispatch({ type: "SAVE_SUCCESS", prompt: result.prompt });
    } catch (err) {
      if (handleConflict(err)) return;
      const msg =
        err instanceof AdminMutationClientError
          ? err.message
          : "Ошибка сохранения";
      dispatch({ type: "SET_SAVE_STATUS", status: "error", error: msg });
    }
  };

  const handlePublish = async (changeSummary: string) => {
    setPublishLoading(true);
    try {
      let revision = state.revision;

      if (isDirty) {
        const saveResult = await adminPromptsApi.update(
          initialPrompt.id,
          buildPatchBody(revision),
        );
        dispatch({ type: "SAVE_SUCCESS", prompt: saveResult.prompt });
        revision = saveResult.prompt.revision;
      }

      await adminPromptsApi.publish(initialPrompt.id, {
        expectedRevision: revision,
        changeSummary: changeSummary || undefined,
      });
      setPublishOpen(false);
      router.push(`/admin/prompts/${initialPrompt.id}`);
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
    fn: () => Promise<{ prompt: AdminPromptDto }>,
  ) => {
    setStatusLoading(key);
    try {
      const result = await fn();
      dispatch({ type: "LOAD_PROMPT", prompt: result.prompt });
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
    <Stack gap={3}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          alignItems: "center",
        }}
      >
        <h1 style={{ margin: 0, flex: "1 1 auto" }}>
          {state.fields.title || "Без названия"}
        </h1>
        {statusBadge()}
        <Button
          size="small"
          variant="outline"
          loading={state.saveStatus === "saving"}
          disabled={!isDirty}
          onClick={save}
        >
          Сохранить
        </Button>
        <Link href={`/admin/prompts/${initialPrompt.id}/preview`} variant="subtle">
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
                adminPromptsApi.hide(initialPrompt.id, state.revision),
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
                adminPromptsApi.archive(initialPrompt.id, state.revision),
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
        <Input
          label="Заголовок"
          value={state.fields.title}
          onChange={(e) => patch({ title: e.target.value })}
        />
        <Input
          label="Slug"
          value={state.fields.slug}
          onChange={(e) => patch({ slug: e.target.value })}
        />
        <Textarea
          label="Краткое описание"
          value={state.fields.summary}
          onChange={(e) => patch({ summary: e.target.value })}
          rows={3}
        />
        <Textarea
          label="Текст промта"
          required
          value={state.fields.promptText}
          onChange={(e) => patch({ promptText: e.target.value })}
          rows={14}
        />
        <Textarea
          label="Входные данные"
          value={state.fields.inputRequirements}
          onChange={(e) => patch({ inputRequirements: e.target.value })}
          rows={4}
        />
        <Textarea
          label="Ожидаемый результат"
          value={state.fields.outputRequirements}
          onChange={(e) => patch({ outputRequirements: e.target.value })}
          rows={4}
        />
        <Textarea
          label="Ограничения"
          value={state.fields.restrictions}
          onChange={(e) => patch({ restrictions: e.target.value })}
          rows={4}
        />
        <Textarea
          label="Пример использования"
          value={state.fields.usageExample}
          onChange={(e) => patch({ usageExample: e.target.value })}
          rows={4}
        />

        <TaxonomyField
          label="Категории"
          options={taxonomy.categories}
          selected={state.fields.categoryIds}
          onChange={(categoryIds) => patch({ categoryIds })}
        />
        <TaxonomyField
          label="Теги"
          options={taxonomy.tags}
          selected={state.fields.tagIds}
          onChange={(tagIds) => patch({ tagIds })}
        />
        <TaxonomyField
          label="Аудитории"
          options={taxonomy.audiences}
          selected={state.fields.audienceIds}
          onChange={(audienceIds) => patch({ audienceIds })}
        />

        <Input
          label="Дата пересмотра"
          type="date"
          value={reviewDateInputValue(state.fields.reviewDueAt)}
          onChange={(e) =>
            patch({ reviewDueAt: reviewDateToIso(e.target.value) })
          }
        />
      </Stack>

      <PromptPublishDialog
        open={publishOpen}
        loading={publishLoading}
        onConfirm={handlePublish}
        onCancel={() => setPublishOpen(false)}
      />
    </Stack>
  );
}
