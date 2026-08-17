"use client";

import { useEffect, useRef, useState } from "react";

import { Alert, Badge, Button, EmptyState, Link } from "@/components/ui";
import { askAssistantClient } from "@/features/assistant/client/assistant-api";
import type { AssistantClientAnswered } from "@/features/assistant/client/public-dto";

import { AssistantAnswer } from "./assistant-answer";
import {
  AssistantQuestionForm,
  filtersAreDefault,
  type AssistantFormFilters,
  type AssistantTaxonomyOption,
} from "./assistant-question-form";
import styles from "./assistant.module.css";

export type AssistantExperienceProps = {
  demonstration: boolean;
  questionMinLength: number;
  questionMaxLength: number;
  categories: AssistantTaxonomyOption[];
  tags: AssistantTaxonomyOption[];
  audiences: AssistantTaxonomyOption[];
};

const DEFAULT_FILTERS: AssistantFormFilters = {
  type: "article",
  category: "",
  tag: "",
  audience: "",
};

type UiState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "answered"; data: AssistantClientAnswered }
  | { kind: "insufficient"; message: string; searchHref?: string }
  | { kind: "validation"; message: string; field?: "question" }
  | { kind: "rate_limited"; message: string }
  | { kind: "unavailable"; message: string };

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function focusElement(id: string) {
  const el = document.getElementById(id);
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

function liveMessageFor(state: UiState): string {
  switch (state.kind) {
    case "pending":
      return "Готовим ответ по опубликованным материалам";
    case "answered":
      return "Ответ готов";
    case "insufficient":
      return "Недостаточно сведений в опубликованных материалах";
    case "validation":
      return "Проверьте формулировку вопроса";
    case "rate_limited":
      return "Слишком много запросов";
    case "unavailable":
      return "Ассистент временно недоступен";
    default:
      return "";
  }
}

function searchHrefHasQuery(href: string): boolean {
  if (!href.startsWith("/search")) return false;
  try {
    const url = new URL(href, "https://knowledge.invalid");
    if (url.pathname !== "/search") return false;
    return url.searchParams.has("q");
  } catch {
    return false;
  }
}

export function AssistantExperience({
  demonstration,
  questionMinLength,
  questionMaxLength,
  categories,
  tags,
  audiences,
}: AssistantExperienceProps) {
  const [question, setQuestion] = useState("");
  const [filters, setFilters] = useState<AssistantFormFilters>(DEFAULT_FILTERS);
  const [state, setState] = useState<UiState>({ kind: "idle" });
  const seqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const focusAfterRef = useRef<string | null>(null);
  const focusSeqRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      seqRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
      focusAfterRef.current = null;
    };
  }, []);

  useEffect(() => {
    const target = focusAfterRef.current;
    const token = focusSeqRef.current;
    if (!target) return;
    focusAfterRef.current = null;
    if (!mountedRef.current || token !== seqRef.current) return;
    focusElement(target);
  }, [state]);

  const queueFocus = (id: string, seq: number) => {
    if (!mountedRef.current || seq !== seqRef.current) return;
    focusSeqRef.current = seq;
    focusAfterRef.current = id;
  };

  const abortCurrent = () => {
    seqRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    focusAfterRef.current = null;
  };

  const submit = async () => {
    const trimmed = question.trim();
    if (trimmed.length < questionMinLength || question.length > questionMaxLength) {
      setState({
        kind: "validation",
        message:
          "Не удалось обработать запрос. Проверьте формулировку вопроса и повторите попытку.",
        field: "question",
      });
      focusElement("assistant-question");
      return;
    }

    abortCurrent();
    const seq = seqRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ kind: "pending" });

    const outcome = await askAssistantClient(
      {
        question,
        filters: {
          type: filters.type,
          category: filters.category || null,
          tag: filters.tag || null,
          audience: filters.audience || null,
        },
      },
      { signal: controller.signal },
    );

    if (!mountedRef.current || seq !== seqRef.current) return;
    if (abortRef.current === controller) {
      abortRef.current = null;
    }

    if (outcome.kind === "aborted") {
      setState({ kind: "idle" });
      return;
    }

    if (outcome.kind === "network" || outcome.kind === "malformed") {
      setState({
        kind: "unavailable",
        message: "Ассистент временно недоступен. Попробуйте позже или воспользуйтесь обычным поиском.",
      });
      queueFocus("assistant-status", seq);
      return;
    }

    const { response } = outcome;
    if (response.status === "answered") {
      setState({ kind: "answered", data: response });
      queueFocus("assistant-answer", seq);
      return;
    }
    if (response.status === "insufficient_evidence") {
      setState({
        kind: "insufficient",
        message: response.message,
        searchHref: response.searchHref,
      });
      queueFocus("assistant-status", seq);
      return;
    }
    if (response.status === "validation_error") {
      setState({
        kind: "validation",
        message: response.message,
        field: "question",
      });
      queueFocus("assistant-question", seq);
      return;
    }
    if (response.status === "rate_limited") {
      setState({ kind: "rate_limited", message: response.message });
      queueFocus("assistant-status", seq);
      return;
    }
    setState({
      kind: "unavailable",
      message: response.message,
    });
    queueFocus("assistant-status", seq);
  };

  const onCancel = () => {
    abortCurrent();
    const seq = seqRef.current;
    setState({ kind: "idle" });
    queueFocus("assistant-question", seq);
    if (mountedRef.current) focusElement("assistant-question");
  };

  const onNewQuestion = () => {
    abortCurrent();
    const seq = seqRef.current;
    setQuestion("");
    setState({ kind: "idle" });
    queueFocus("assistant-question", seq);
    if (mountedRef.current) focusElement("assistant-question");
  };

  const onClearFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const showResult = state.kind !== "idle" && state.kind !== "pending";
  const questionError =
    state.kind === "validation" && state.field === "question"
      ? state.message
      : undefined;

  return (
    <div className={styles.workspace}>
      <header className={styles.intro}>
        <h1>Ассистент</h1>
        <p className={styles.lede}>
          Один вопрос по опубликованным материалам портала. Это не переписка и
          не чат.
        </p>
        {demonstration ? (
          <div className={styles.demoRow}>
            <Badge tone="warning">Проверочный режим</Badge>
            <p className={styles.demoNote}>
              Ответы формируются тестовым адаптером, это не рабочий ИИ.
            </p>
          </div>
        ) : null}
      </header>

      <AssistantQuestionForm
        question={question}
        filters={filters}
        questionMinLength={questionMinLength}
        questionMaxLength={questionMaxLength}
        categories={categories}
        tags={tags}
        audiences={audiences}
        pending={state.kind === "pending"}
        questionError={questionError}
        onQuestionChange={setQuestion}
        onFiltersChange={setFilters}
        onSubmit={() => {
          void submit();
        }}
        onCancel={onCancel}
        onNewQuestion={onNewQuestion}
        onClearFilters={onClearFilters}
        showNewQuestion={showResult}
      />

      <div className={styles.liveRegion} aria-live="polite" aria-atomic="true">
        {liveMessageFor(state)}
      </div>

      {state.kind === "pending" ? (
        <p className={styles.pendingVisible}>
          Готовим ответ по опубликованным материалам
        </p>
      ) : null}

      {state.kind === "validation" && !state.field ? (
        <div
          id="assistant-error-summary"
          className={styles.statusRegion}
          tabIndex={-1}
          role="alert"
        >
          <Alert tone="error" title="Не удалось отправить вопрос">
            {state.message}
          </Alert>
        </div>
      ) : null}

      {state.kind === "insufficient" ||
      state.kind === "rate_limited" ||
      state.kind === "unavailable" ? (
        <div
          id="assistant-status"
          className={styles.statusRegion}
          tabIndex={-1}
        >
          {state.kind === "insufficient" ? (
            <EmptyState
              title="Недостаточно сведений"
              description={state.message}
              primaryAction={
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => focusElement("assistant-question")}
                >
                  Изменить вопрос
                </Button>
              }
              secondaryAction={
                !filtersAreDefault(filters) ? (
                  <Button type="button" variant="ghost" onClick={onClearFilters}>
                    Сбросить фильтры
                  </Button>
                ) : undefined
              }
            />
          ) : null}
          {state.kind === "insufficient" && state.searchHref ? (
            <>
              {searchHrefHasQuery(state.searchHref) ? (
                <p className={styles.searchFallbackNote}>
                  При переходе формулировка вопроса попадёт в адресную строку
                  поиска и историю браузера.
                </p>
              ) : null}
              <p style={{ margin: 0 }}>
                <Link href={state.searchHref} variant="standalone">
                  Открыть обычный поиск
                </Link>
              </p>
            </>
          ) : null}
          {state.kind === "rate_limited" ? (
            <Alert tone="warning" title="Слишком много запросов">
              {state.message}
              <div className={styles.actions}>
                <Button type="button" variant="secondary" onClick={() => void submit()}>
                  Повторить
                </Button>
              </div>
            </Alert>
          ) : null}
          {state.kind === "unavailable" ? (
            <Alert tone="warning" title="Ассистент временно недоступен">
              {state.message}
              <div className={styles.actions}>
                <Button type="button" variant="secondary" onClick={() => void submit()}>
                  Повторить
                </Button>
                <Link href="/search" variant="standalone">
                  Открыть поиск
                </Link>
              </div>
            </Alert>
          ) : null}
        </div>
      ) : null}

      {state.kind === "answered" ? (
        <section
          id="assistant-answer"
          className={styles.answerRegion}
          tabIndex={-1}
          aria-labelledby="assistant-answer-heading"
        >
          <AssistantAnswer data={state.data} />
        </section>
      ) : null}
    </div>
  );
}
