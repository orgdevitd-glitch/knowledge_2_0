import type { IsoDateTime } from "@/domain/shared/value-objects";

export type ReviewStatus = "current" | "due-soon" | "overdue";

export type ReviewStatusLabel =
  | "Актуально"
  | "Скоро потребуется проверка"
  | "Требуется проверка";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DUE_SOON_DAYS = 14;

export function resolveReviewStatus(
  reviewDueAt: IsoDateTime | string | null | undefined,
  now: IsoDateTime | string,
): ReviewStatus | null {
  if (!reviewDueAt) {
    return null;
  }
  const due = Date.parse(reviewDueAt);
  const current = Date.parse(now);
  if (Number.isNaN(due) || Number.isNaN(current)) {
    return null;
  }
  if (current >= due) {
    return "overdue";
  }
  if (due - current <= DUE_SOON_DAYS * MS_PER_DAY) {
    return "due-soon";
  }
  return "current";
}

export function reviewStatusLabel(
  status: ReviewStatus | null | undefined,
): ReviewStatusLabel | null {
  if (!status) return null;
  switch (status) {
    case "due-soon":
      return "Скоро потребуется проверка";
    case "overdue":
      return "Требуется проверка";
    case "current":
      return "Актуально";
  }
}

export function reviewStatusTone(
  status: ReviewStatus | null | undefined,
): "success" | "warning" | "error" | null {
  if (!status) return null;
  switch (status) {
    case "due-soon":
      return "warning";
    case "overdue":
      return "error";
    case "current":
      return "success";
  }
}
