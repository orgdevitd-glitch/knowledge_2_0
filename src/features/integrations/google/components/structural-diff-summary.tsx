import type { StructuralArticleDiff } from "@/features/integrations/google/application/structural-diff";

export function StructuralDiffSummary({
  diff,
}: {
  diff: StructuralArticleDiff;
}) {
  return (
    <section aria-labelledby="structural-diff-heading">
      <h2 id="structural-diff-heading">Сравнение с целевой статьёй</h2>
      <ul style={{ margin: 0, paddingInlineStart: "1.25rem" }}>
        <li>
          Заголовок: {diff.titleChanged ? "изменится" : "без изменений"}
        </li>
        <li>
          Краткое описание: {diff.summaryChanged ? "изменится" : "без изменений"}
        </li>
        <li>
          Блоков: {diff.blockCountBefore} → {diff.blockCountAfter}
        </li>
        <li>Добавлено блоков: {diff.addedBlockIds.length}</li>
        <li>Удалено блоков: {diff.removedBlockIds.length}</li>
        <li>Изменено блоков: {diff.changedBlockIds.length}</li>
      </ul>
      {diff.headingStructureBefore.length > 0 ||
      diff.headingStructureAfter.length > 0 ? (
        <div
          style={{
            display: "grid",
            gap: "0.75rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(14rem, 1fr))",
            marginTop: "0.75rem",
          }}
        >
          <div>
            <h3 style={{ fontSize: "1rem" }}>Структура заголовков сейчас</h3>
            <ol style={{ margin: 0, paddingInlineStart: "1.25rem" }}>
              {diff.headingStructureBefore.length === 0 ? (
                <li>Нет заголовков</li>
              ) : (
                diff.headingStructureBefore.map((item) => (
                  <li key={`before-${item}`}>{item}</li>
                ))
              )}
            </ol>
          </div>
          <div>
            <h3 style={{ fontSize: "1rem" }}>После импорта</h3>
            <ol style={{ margin: 0, paddingInlineStart: "1.25rem" }}>
              {diff.headingStructureAfter.length === 0 ? (
                <li>Нет заголовков</li>
              ) : (
                diff.headingStructureAfter.map((item) => (
                  <li key={`after-${item}`}>{item}</li>
                ))
              )}
            </ol>
          </div>
        </div>
      ) : null}
    </section>
  );
}
