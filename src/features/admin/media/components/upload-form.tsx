"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Stack } from "@/components/layout";
import { Alert, Button, Input, NativeSelect, Textarea } from "@/components/ui";
import {
  MEDIA_KIND_VALUES,
  MEDIA_LIMIT_DEFAULTS,
  maxBytesForKind,
  type MediaKindValue,
} from "@/domain/shared/media-limits";
import {
  AdminMutationClientError,
  adminMediaApi,
  uploadMediaBinary,
} from "@/features/admin/media/client/admin-media-api";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaUploadForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<MediaKindValue>("image");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [defaultAltText, setDefaultAltText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxBytes = maxBytesForKind(kind, {
    imageMaxBytes: MEDIA_LIMIT_DEFAULTS.imageMaxBytes,
    documentMaxBytes: MEDIA_LIMIT_DEFAULTS.documentMaxBytes,
  });

  const onFileChange = (next: File | null) => {
    setError(null);
    if (!next) {
      setFile(null);
      return;
    }
    if (next.size > maxBytes) {
      setError(
        `Файл слишком большой (макс. ${formatBytes(maxBytes)} для ${kind}).`,
      );
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setFile(next);
    const base = next.name.replace(/\.[^.]+$/, "").trim();
    if (base && !title.trim()) {
      setTitle(base.slice(0, 200));
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Выберите файл.");
      return;
    }
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Укажите название.");
      return;
    }

    setLoading(true);
    try {
      const start = await adminMediaApi.startUpload({
        kind,
        title: trimmedTitle,
        description: description.trim() || null,
        defaultAltText: defaultAltText.trim() || null,
        originalFileName: file.name,
        declaredSizeBytes: file.size,
      });

      await uploadMediaBinary(
        start.uploadUrl,
        file,
        start.requiredHeaders ?? { "Content-Type": "application/octet-stream" },
      );
      await adminMediaApi.complete(start.media.id, start.media.revision);

      router.push(`/admin/media/${start.media.id}`);
    } catch (err) {
      const msg =
        err instanceof AdminMutationClientError
          ? err.message
          : "Ошибка загрузки";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <Stack gap={3}>
        {error ? (
          <Alert tone="error" title="Ошибка">
            {error}
          </Alert>
        ) : null}

        <NativeSelect
          label="Тип"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as MediaKindValue);
            setFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
          options={MEDIA_KIND_VALUES.map((value) => ({
            value,
            label: value === "image" ? "Изображение" : "Документ",
          }))}
          description={`Макс. размер: ${formatBytes(maxBytes)}`}
        />

        <label>
          Файл{" "}
          <input
            ref={fileInputRef}
            type="file"
            accept={kind === "image" ? "image/jpeg,image/png,image/webp" : ".pdf,.txt,.csv,text/plain,text/csv,application/pdf"}
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
        </label>
        {file ? (
          <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
            {file.name} · {formatBytes(file.size)}
          </p>
        ) : null}

        <Input
          label="Название"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <Textarea
          label="Описание"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          description={`Не более ${MEDIA_LIMIT_DEFAULTS.descriptionMax} символов`}
        />

        <Input
          label="Alt-текст по умолчанию"
          value={defaultAltText}
          onChange={(e) => setDefaultAltText(e.target.value)}
          description="Для изображений; используется, если alt в блоке не задан"
        />

        <Button type="submit" loading={loading} disabled={loading}>
          Загрузить
        </Button>
      </Stack>
    </form>
  );
}
