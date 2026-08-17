import type { AssistantClientAnswered } from "@/features/assistant/client/public-dto";

import { AssistantSourceCard } from "./assistant-source-card";
import styles from "./assistant.module.css";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function focusSource(number: number) {
  const el = document.getElementById(`assistant-source-${number}`);
  if (!el) return;
  if ("isConnected" in el && !el.isConnected) return;
  el.focus({ preventScroll: true });
  if (typeof el.scrollIntoView === "function") {
    el.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
  }
}

export function AssistantAnswer({
  data,
}: {
  data: AssistantClientAnswered;
}) {
  const titleByNumber = new Map(
    data.citations.map((c) => [c.number, c.title]),
  );

  return (
    <div className={styles.answerRegion}>
      <h2 id="assistant-answer-heading" className={styles.answerHeading}>
        Ответ
      </h2>
      <p className={styles.disclaimer}>
        Ответ сформирован автоматически по опубликованным материалам. Проверяйте
        сведения по источникам.
      </p>
      {data.blocks.map((block, index) => (
        <div key={`block-${index}`} className={styles.block}>
          <p className={styles.blockText}>{block.text}</p>
          <div className={styles.chips}>
            {block.citationNumbers.map((n) => (
              <button
                key={`chip-${index}-${n}`}
                type="button"
                className={styles.chip}
                aria-label={`Источник ${n}: ${titleByNumber.get(n) ?? ""}`}
                onClick={() => focusSource(n)}
              >
                [{n}]
              </button>
            ))}
          </div>
        </div>
      ))}
      <section className={styles.sources} aria-labelledby="assistant-sources-heading">
        <h2 id="assistant-sources-heading" className={styles.sourcesHeading}>
          Источники
        </h2>
        <ol className={styles.sourceList}>
          {data.citations.map((source) => (
            <li key={source.number}>
              <AssistantSourceCard source={source} />
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
