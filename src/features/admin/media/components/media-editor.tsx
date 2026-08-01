"use client";

import { useCallback, useEffect, useReducer } from "react";
import { useRouter } from "next/navigation";

import { Stack } from "@/components/layout";
import { Badge, Button, Input, Link, Textarea } from "@/components/ui";
import { ConflictAlert } from "@/features/admin/articles/components/conflict-alert";
import type { AdminMediaDto } from "@/features/admin/media/admin-media-dto";
import type { AdminMediaActions } from "@/features/admin/media/queries";
import {
  AdminMutationClientError,
  adminMediaApi,
} from "@/features/admin/media/client/admin-media-api";
import { MEDIA_LIMIT_DEFAULTS } from "@/domain/shared/media-limits";

type EditorFields = {
  title: string;
  description: string;
  defaultAltText: string;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

type EditorState = {
  fields: EditorFields;
  savedFields: EditorFields;
  revision: number;
  status: AdminMediaDto["status"];
  saveStatus: SaveStatus;
  saveError: string | null;
  conflictOpen: boolean;
};

type EditorAction =
  | { type: "SET_FIELDS"; fields: EditorFields }
  | { type: "SET_SAVE_STATUS"; status: SaveStatus; error?: string | null }
  | { type: "SAVE_SUCCESS"; media: AdminMediaDto }
  | { type: "SET_CONFLICT"; open: boolean };

function fieldsFromMedia(media: AdminMediaDto): EditorFields {
  return {
    title: media.title,
    description: media.description ?? "",
    defaultAltText: media.defaultAltText ?? "",
  };
}

function fieldsEqual(a: EditorFields, b: EditorFields): boolean {
  return (
    a.title === b.title &&
    a.description === b.description &&
    a.defaultAltText === b.defaultAltText
  );
}

function initState(media: AdminMediaDto): EditorState {
  const fields = fieldsFromMedia(media);
  return {
    fields,
    savedFields: fields,
    revision: media.revision,
    status: media.status,
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
      const fields = fieldsFromMedia(action.media);
      return {
        ...state,
        fields,
        savedFields: fields,
        revision: action.media.revision,
        status: action.media.status,
        saveStatus: "saved",
        saveError: null,
        conflictOpen: false,
      };
    }
    case "SET_CONFLICT":
      return { ...state, conflictOpen: action.open };
    default:
      return state;
  }
}

export type MediaEditorProps = {
  initialMedia: AdminMediaDto;
  actions: AdminMediaActions;
};

export function MediaEditor({ initialMedia, actions }: MediaEditorProps) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, initialMedia, initState);
  const isDirty = !fieldsEqual(state.fields, state.savedFields);

  const patch = (partial: Partial<EditorFields>) => {
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
      dispatch({
        type: "SET_SAVE_STATUS",
        status: "error",
        error: err.message,
      });
      return true;
    }
    return false;
  }, []);

  const save = async () => {
    dispatch({ type: "SET_SAVE_STATUS", status: "saving" });
    try {
      const result = await adminMediaApi.updateMetadata(initialMedia.id, {
        expectedRevision: state.revision,
        title: state.fields.title.trim(),
        description: state.fields.description.trim() || null,
        defaultAltText: state.fields.defaultAltText.trim() || null,
      });
      dispatch({ type: "SAVE_SUCCESS", media: result.media });
    } catch (err) {
      if (handleConflict(err)) return;
      const msg =
        err instanceof AdminMutationClientError
          ? err.message
          : "Ошибка сохранения";
      dispatch({ type: "SET_SAVE_STATUS", status: "error", error: msg });
    }
  };

  const statusBadge = () => {
    if (state.conflictOpen) return <Badge tone="warning">Конфликт</Badge>;
    if (state.saveStatus === "saving") {
      return <Badge tone="information">Сохранение…</Badge>;
    }
    if (state.saveStatus === "saved") return <Badge tone="success">Сохранено</Badge>;
    if (state.saveStatus === "error") return <Badge tone="error">Ошибка</Badge>;
    if (isDirty) return <Badge tone="accent">Есть изменения</Badge>;
    return <Badge>{state.status}</Badge>;
  };

  if (!actions.canEdit) {
    return (
      <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
        Метаданные недоступны для редактирования в статусе{" "}
        <code>{initialMedia.status}</code>.
      </p>
    );
  }

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
        <h1 style={{ margin: 0, fontSize: "1.25rem" }}>{initialMedia.title}</h1>
        {statusBadge()}
      </div>

      {state.conflictOpen ? (
        <ConflictAlert
          onRefresh={() => router.refresh()}
          onKeepLocal={() => dispatch({ type: "SET_CONFLICT", open: false })}
        />
      ) : null}

      {state.saveError && !state.conflictOpen ? (
        <p style={{ margin: 0, color: "var(--color-error)" }}>{state.saveError}</p>
      ) : null}

      <Input
        label="Название"
        value={state.fields.title}
        onChange={(e) => patch({ title: e.target.value })}
      />

      <Textarea
        label="Описание"
        value={state.fields.description}
        onChange={(e) => patch({ description: e.target.value })}
        description={`Не более ${MEDIA_LIMIT_DEFAULTS.descriptionMax} символов`}
      />

      <Input
        label="Alt-текст по умолчанию"
        value={state.fields.defaultAltText}
        onChange={(e) => patch({ defaultAltText: e.target.value })}
      />

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <Button
          type="button"
          onClick={save}
          loading={state.saveStatus === "saving"}
          disabled={!isDirty}
        >
          Сохранить
        </Button>
        <Link href={`/admin/media/${initialMedia.id}`} variant="subtle">
          К карточке
        </Link>
      </div>
    </Stack>
  );
}
