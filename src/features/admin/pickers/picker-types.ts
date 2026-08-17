export type PickerMediaItem = {
  id: string;
  title: string;
  kind: string;
  status: string;
  originalFileName: string;
  publicPath: string | null;
  selectable: boolean;
  unavailable: boolean;
};

export type PickerMaterialItem = {
  id: string;
  title: string;
  entityType: "article" | "prompt";
  status: string;
  summary: string | null;
  selectable: boolean;
  unavailable: boolean;
};

export function mediaStatusLabel(status: string): string {
  switch (status) {
    case "ready":
      return "Готово";
    case "uploading":
      return "Загрузка";
    case "failed":
      return "Ошибка";
    case "archived":
      return "Архив";
    case "missing":
      return "Недоступно";
    default:
      return status;
  }
}

export function materialStatusLabel(status: string): string {
  switch (status) {
    case "published":
      return "Опубликован";
    case "draft":
      return "Черновик";
    case "hidden":
      return "Скрыт";
    case "archived":
      return "Архив";
    case "missing":
      return "Недоступно";
    default:
      return status;
  }
}

export function mediaKindLabel(kind: string): string {
  if (kind === "image") return "Изображение";
  if (kind === "document") return "Документ";
  return kind;
}

/** Only the existing public media route — never GCS/storage URLs from the API. */
export function safeMediaPreviewPath(
  mediaId: string,
  publicPath: string | null | undefined,
): string | null {
  if (!mediaId || !publicPath) return null;
  const expected = `/media/${mediaId}`;
  return publicPath === expected ? expected : null;
}

export function isAbortError(error: unknown): boolean {
  return (
    (typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}
