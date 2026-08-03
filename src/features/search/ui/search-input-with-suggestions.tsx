"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui";
import { SEARCH_LIMIT_DEFAULTS } from "@/domain/search/search-limits";
import { isSafePublicSearchHref } from "@/domain/search/search-href";
import {
  applySearchUrlPatch,
  buildSearchHref,
  parseSearchUrlState,
  type SearchUrlState,
} from "@/features/search/url/search-url-state";
import { markSearchFocusIntent } from "@/features/search/ui/search-focus-intent";

import styles from "./search.module.css";

export type SearchSuggestionDto = {
  kind: "title" | "category" | "tag" | "audience";
  label: string;
  entityType: "article" | "prompt" | null;
  href: string | null;
  filterKey: "category" | "tag" | "audience" | null;
  filterId: string | null;
};

export type SearchInputVariant = "page" | "header" | "home";

type Props = {
  variant: SearchInputVariant;
  urlState?: SearchUrlState;
  defaultQuery?: string;
  maxLength: number;
  /** Optional stable prefix; always combined with useId for uniqueness. */
  idPrefix?: string;
  label?: string;
  hideLabel?: boolean;
  pending?: boolean;
  onPendingChange?: (pending: boolean) => void;
  name?: string;
};

function kindLabel(kind: SearchSuggestionDto["kind"]): string {
  switch (kind) {
    case "title":
      return "Материал";
    case "category":
      return "Категория";
    case "tag":
      return "Тег";
    case "audience":
      return "Аудитория";
  }
}

function baseStateForVariant(
  variant: SearchInputVariant,
  urlState: SearchUrlState | undefined,
  q: string,
): SearchUrlState {
  if (variant === "page" && urlState) {
    return { ...urlState, q };
  }
  return {
    q,
    type: null,
    category: null,
    tag: null,
    audience: null,
    cursor: null,
  };
}

export function SearchInputWithSuggestions({
  variant,
  urlState,
  defaultQuery = "",
  maxLength,
  idPrefix,
  label = "Поиск",
  hideLabel = false,
  pending = false,
  onPendingChange,
  name = "q",
}: Props) {
  const router = useRouter();
  const reactId = useId();
  const instancePrefix = idPrefix ? `${idPrefix}-${reactId}` : reactId;
  const listboxId = `${instancePrefix}-listbox`;
  const resolvedInputId = `${instancePrefix}-input`;
  const [query, setQuery] = useState(defaultQuery);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SearchSuggestionDto[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  /** Per-instance only — never module-level. */
  const abortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);
  const allowOpenRef = useRef(true);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const invalidatePendingRequests = useCallback(() => {
    requestSeqRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const closeList = useCallback(() => {
    allowOpenRef.current = false;
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  const fetchSuggestions = useCallback(
    async (q: string, filters: SearchUrlState) => {
      const prefix = q.trim();
      if (prefix.length < SEARCH_LIMIT_DEFAULTS.suggestionsMinPrefix) {
        invalidatePendingRequests();
        setItems([]);
        setOpen(false);
        setStatusMessage(null);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const seq = ++requestSeqRef.current;
      allowOpenRef.current = true;

      const params = new URLSearchParams();
      params.set("q", prefix);
      if (variant === "page") {
        if (filters.type) params.set("type", filters.type);
        if (filters.category) params.set("category", filters.category);
        if (filters.tag) params.set("tag", filters.tag);
        if (filters.audience) params.set("audience", filters.audience);
      }
      params.set("limit", String(SEARCH_LIMIT_DEFAULTS.suggestionsMaxItems));

      try {
        const res = await fetch(`/api/search/suggestions?${params.toString()}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!mountedRef.current || seq !== requestSeqRef.current) return;
        if (res.status === 400) {
          setItems([]);
          setOpen(false);
          setStatusMessage(null);
          return;
        }
        if (res.status === 429 || res.status === 503) {
          setItems([]);
          setOpen(false);
          setStatusMessage("Подсказки временно недоступны");
          return;
        }
        if (!res.ok) {
          setItems([]);
          setOpen(false);
          setStatusMessage(null);
          return;
        }
        const data = (await res.json()) as {
          items?: SearchSuggestionDto[];
          status?: string;
        };
        if (!mountedRef.current || seq !== requestSeqRef.current) return;
        const next = Array.isArray(data.items) ? data.items : [];
        setItems(next);
        if (allowOpenRef.current && next.length > 0) {
          setOpen(true);
          setActiveIndex(0);
        } else {
          setOpen(false);
          setActiveIndex(-1);
        }
        setStatusMessage(null);
      } catch (error) {
        if ((error as { name?: string }).name === "AbortError") return;
        if (!mountedRef.current || seq !== requestSeqRef.current) return;
        setItems([]);
        setOpen(false);
        setStatusMessage(null);
      }
    },
    [invalidatePendingRequests, variant],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      invalidatePendingRequests();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [invalidatePendingRequests]);

  useEffect(() => {
    if (composing) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const filters = baseStateForVariant(variant, urlState, query);
      void fetchSuggestions(query, filters);
    }, SEARCH_LIMIT_DEFAULTS.suggestionsDebounceMs);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, composing, fetchSuggestions, urlState, variant]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        closeList();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [closeList]);

  const selectItem = (item: SearchSuggestionDto) => {
    closeList();
    invalidatePendingRequests();
    if (item.kind === "title" && item.href && isSafePublicSearchHref(item.href)) {
      // Do not mark search-results focus — leaving the search page.
      onPendingChange?.(true);
      router.push(item.href);
      return;
    }
    if (item.filterKey && item.filterId) {
      const current = baseStateForVariant(variant, urlState, query);
      const next = applySearchUrlPatch(current, {
        [item.filterKey]: item.filterId,
        cursor: null,
      });
      next.q = query;
      onPendingChange?.(true);
      markSearchFocusIntent();
      router.push(buildSearchHref(next, { hash: "search-results" }));
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (composing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeList();
      invalidatePendingRequests();
      return;
    }
    if (!open || items.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % items.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i <= 0 ? items.length - 1 : i - 1));
      return;
    }
    if (event.key === "Enter" && activeIndex >= 0 && items[activeIndex]) {
      event.preventDefault();
      selectItem(items[activeIndex]!);
    }
  };

  const activeOptionId =
    open && activeIndex >= 0
      ? `${listboxId}-option-${activeIndex}`
      : undefined;

  return (
    <div className={styles.combobox} ref={wrapRef} data-search-combobox={instancePrefix}>
      {hideLabel ? (
        <label className={styles.srOnly} htmlFor={resolvedInputId}>
          {label}
        </label>
      ) : (
        <label htmlFor={resolvedInputId}>{label}</label>
      )}
      <input
        id={resolvedInputId}
        type="search"
        name={name}
        value={query}
        maxLength={maxLength}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        aria-busy={pending || undefined}
        placeholder="Найти материал…"
        onChange={(e) => {
          allowOpenRef.current = true;
          setQuery(e.target.value);
        }}
        onKeyDown={onKeyDown}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={(e) => {
          setComposing(false);
          setQuery(e.currentTarget.value);
        }}
        onFocus={() => {
          if (allowOpenRef.current && items.length > 0) setOpen(true);
        }}
      />
      {open && items.length > 0 ? (
        <ul id={listboxId} role="listbox" className={styles.listbox}>
          {items.map((item, index) => (
            <li
              key={`${item.kind}:${item.filterId ?? item.href ?? item.label}:${index}`}
              id={`${listboxId}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className={`${styles.option}${index === activeIndex ? ` ${styles.optionActive}` : ""}`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(e) => {
                e.preventDefault();
                selectItem(item);
              }}
            >
              <span className={styles.optionKind}>{kindLabel(item.kind)}</span>
              <span className={styles.optionLabel}>{item.label}</span>
            </li>
          ))}
        </ul>
      ) : (
        <ul id={listboxId} role="listbox" hidden className={styles.listbox} />
      )}
      {statusMessage ? (
        <p className={styles.suggestStatus} role="status">
          {statusMessage}
        </p>
      ) : null}
    </div>
  );
}

/** Thin form wrapper for header/home — no filter carry-over. */
export function GlobalSearchForm({
  variant,
  defaultQuery = "",
  maxLength,
}: {
  variant: "header" | "home";
  defaultQuery?: string;
  /** Runtime SEARCH_QUERY_MAX_LENGTH from server props — required. */
  maxLength: number;
}) {
  const [pending, setPending] = useState(false);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    const form = event.currentTarget;
    const data = new FormData(form);
    const q = String(data.get("q") ?? "");
    const href = buildSearchHref(parseSearchUrlState({ q }), {
      hash: "search-results",
    });
    event.preventDefault();
    setPending(true);
    markSearchFocusIntent();
    window.location.assign(href);
  };

  return (
    <form
      method="get"
      action="/search"
      role="search"
      aria-label="Поиск по порталу"
      onSubmit={onSubmit}
      className={styles.queryRow}
      data-search-max-length={maxLength}
    >
      <SearchInputWithSuggestions
        key={`${variant}:${defaultQuery}:${maxLength}`}
        variant={variant}
        defaultQuery={defaultQuery}
        maxLength={maxLength}
        idPrefix={variant}
        hideLabel
        label="Поиск"
        pending={pending}
        onPendingChange={setPending}
      />
      <Button type="submit" loading={pending}>
        {pending ? "Ищем…" : "Найти"}
      </Button>
      {pending ? (
        <span className={styles.liveRegion} aria-live="polite">
          Выполняется поиск
        </span>
      ) : null}
    </form>
  );
}
