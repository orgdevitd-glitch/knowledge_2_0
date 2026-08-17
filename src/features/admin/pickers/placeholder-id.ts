/** Factory placeholders such as `media_pending` / `article_pending`. */
export function isUnsetReferenceId(value: string | null | undefined): boolean {
  if (value == null) return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  return /pending/i.test(trimmed);
}
