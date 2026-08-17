"use client";

import type { FormEvent, KeyboardEvent } from "react";

import {
  Alert,
  Button,
  NativeSelect,
  RadioGroup,
  Textarea,
} from "@/components/ui";

import styles from "./assistant.module.css";

export type AssistantTaxonomyOption = { id: string; title: string };

export type AssistantFormFilters = {
  type: "article" | "prompt" | "all";
  category: string;
  tag: string;
  audience: string;
};

const TYPE_OPTIONS = [
  { value: "article", label: "Статьи" },
  { value: "prompt", label: "Промты" },
  { value: "all", label: "Все материалы" },
];

export function filtersAreDefault(filters: AssistantFormFilters): boolean {
  return (
    filters.type === "article" &&
    !filters.category &&
    !filters.tag &&
    !filters.audience
  );
}

export function AssistantQuestionForm({
  question,
  filters,
  questionMinLength,
  questionMaxLength,
  categories,
  tags,
  audiences,
  pending,
  questionError,
  onQuestionChange,
  onFiltersChange,
  onSubmit,
  onCancel,
  onNewQuestion,
  onClearFilters,
  showNewQuestion,
}: {
  question: string;
  filters: AssistantFormFilters;
  questionMinLength: number;
  questionMaxLength: number;
  categories: AssistantTaxonomyOption[];
  tags: AssistantTaxonomyOption[];
  audiences: AssistantTaxonomyOption[];
  pending: boolean;
  questionError?: string;
  onQuestionChange: (value: string) => void;
  onFiltersChange: (next: AssistantFormFilters) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onNewQuestion: () => void;
  onClearFilters: () => void;
  showNewQuestion: boolean;
}) {
  const showPromptWarning =
    filters.type === "prompt" || filters.type === "all";
  const filtersDirty = !filtersAreDefault(filters);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    onSubmit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (
      event.key === "Enter" &&
      !event.ctrlKey &&
      !event.metaKey &&
      event.target instanceof HTMLTextAreaElement
    ) {
      event.stopPropagation();
    }
  };

  return (
    <form
      className={styles.form}
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      aria-label="Форма вопроса ассистенту"
      data-assistant-pending={pending ? "true" : "false"}
    >
      <Textarea
        id="assistant-question"
        label="Вопрос"
        name="question"
        required
        value={question}
        onChange={(e) => onQuestionChange(e.target.value)}
        minLength={questionMinLength}
        maxLength={questionMaxLength}
        rows={5}
        disabled={pending}
        error={questionError}
        description={`Не меньше ${questionMinLength} и не больше ${questionMaxLength} символов.`}
      />
      <p className={styles.counter}>
        {question.length} / {questionMaxLength}
      </p>

      <RadioGroup
        name="assistantType"
        legend="Тип материалов"
        value={filters.type}
        disabled={pending}
        onChange={(value) =>
          onFiltersChange({
            ...filters,
            type: value as AssistantFormFilters["type"],
          })
        }
        options={TYPE_OPTIONS}
      />

      {showPromptWarning ? (
        <Alert
          tone="information"
          title="Справочные промты"
          className={styles.warning}
        >
          Материалы библиотеки промтов могут использоваться как справочные
          источники. Они не запускаются и не исполняются автоматически.
        </Alert>
      ) : null}

      <details className={styles.filtersDetails}>
        <summary className={styles.filtersToggle}>Уточнить поиск</summary>
        <div className={styles.filtersPanel}>
          <NativeSelect
            label="Категория"
            name="category"
            disabled={pending}
            value={filters.category}
            onChange={(e) =>
              onFiltersChange({ ...filters, category: e.target.value })
            }
            options={[
              { value: "", label: "Все категории" },
              ...categories.map((o) => ({ value: o.id, label: o.title })),
            ]}
          />
          <NativeSelect
            label="Тег"
            name="tag"
            disabled={pending}
            value={filters.tag}
            onChange={(e) =>
              onFiltersChange({ ...filters, tag: e.target.value })
            }
            options={[
              { value: "", label: "Все теги" },
              ...tags.map((o) => ({ value: o.id, label: o.title })),
            ]}
          />
          <NativeSelect
            label="Аудитория"
            name="audience"
            disabled={pending}
            value={filters.audience}
            onChange={(e) =>
              onFiltersChange({ ...filters, audience: e.target.value })
            }
            options={[
              { value: "", label: "Все аудитории" },
              ...audiences.map((o) => ({ value: o.id, label: o.title })),
            ]}
          />
        </div>
      </details>

      <div className={styles.actions}>
        <Button type="submit" loading={pending} disabled={pending}>
          {pending ? "Готовим ответ…" : "Спросить"}
        </Button>
        {pending ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Отменить ожидание
          </Button>
        ) : null}
        {showNewQuestion && !pending ? (
          <Button type="button" variant="secondary" onClick={onNewQuestion}>
            Новый вопрос
          </Button>
        ) : null}
        {filtersDirty && !pending ? (
          <Button type="button" variant="ghost" onClick={onClearFilters}>
            Сбросить фильтры
          </Button>
        ) : null}
      </div>

      <p className={styles.privacy}>
        Вопрос отправляется, чтобы подобрать ответ по опубликованным материалам
        портала. История вопросов в портале не сохраняется. Это не переписка и
        не личный кабинет.
      </p>
      <p className={styles.note}>
        Если ответа нет, информация всё равно может находиться в каталоге или
        обычном поиске.
      </p>
    </form>
  );
}
