"use client";

import { useMemo, useState, type ReactNode } from "react";

import {
  MOCK_MARKER,
  audienceLabel,
  freshnessLabel,
  mockAdminBlocks,
  mockArticle,
  mockMaterials,
  mockNav,
  mockPrompts,
  mockRoles,
  mockVideo,
  typeLabel,
  type MockMaterial,
  type MockPrompt,
} from "./mock-data";
import type { DesignDirectionId, PrototypeScenario } from "./types";
import { SCENARIO_LABELS } from "./types";

import "./tokens/shared.css";
import "./tokens/editorial.css";
import "./tokens/workspace.css";
import "./tokens/learning.css";
import "./direction-chrome.css";

type DirectionViewProps = {
  direction: DesignDirectionId;
  remountKey: number;
};

function FreshnessChip({
  freshness,
}: {
  freshness: MockMaterial["freshness"];
}) {
  const tone =
    freshness === "current" ? "ok" : freshness === "review-soon" ? "warn" : "bad";
  return (
    <span className="dd-chip" data-tone={tone}>
      <span className="dd-sr-only">Статус: </span>
      {freshnessLabel[freshness]}
    </span>
  );
}

function MaterialCard({
  material,
  selected,
  onSelect,
  compact,
}: {
  material: MockMaterial;
  selected: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  return (
    <article
      className={compact ? "dd-list-item" : "dd-card dd-hover-lift"}
      data-selected={selected ? "true" : "false"}
    >
      <h3 className="dd-display">{material.title}</h3>
      <p style={{ margin: 0, color: "var(--dd-color-muted-text)" }}>
        {material.summary}
      </p>
      <div className="dd-meta" aria-label="Метаданные материала">
        <span className="dd-chip">{material.category}</span>
        <span className="dd-chip">{typeLabel[material.type]}</span>
        <span>Обновлено {material.updatedAtLabel}</span>
        <FreshnessChip freshness={material.freshness} />
        <span>{audienceLabel[material.audience]}</span>
      </div>
      <p style={{ marginTop: "0.75rem" }}>
        <button type="button" className="dd-btn" onClick={onSelect}>
          Открыть
        </button>
      </p>
    </article>
  );
}

export function DirectionView({ direction, remountKey }: DirectionViewProps) {
  const [scenario, setScenario] = useState<PrototypeScenario>("home");
  const [navOpen, setNavOpen] = useState(false);
  const [activeNav, setActiveNav] = useState("home");
  const [selectedMaterialId, setSelectedMaterialId] = useState(
    mockMaterials[0]?.id ?? "",
  );
  const [selectedPromptId, setSelectedPromptId] = useState(
    mockPrompts[0]?.id ?? "",
  );
  const [audienceFilter, setAudienceFilter] = useState<
    "all" | "managers" | "specialists" | "editors"
  >("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [adminDirty, setAdminDirty] = useState(true);
  const [adminSelected, setAdminSelected] = useState(
    mockAdminBlocks.find((b) => b.selected)?.id ?? mockAdminBlocks[0]?.id ?? "",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const selectedPrompt: MockPrompt | undefined = useMemo(
    () => mockPrompts.find((p) => p.id === selectedPromptId) ?? mockPrompts[0],
    [selectedPromptId],
  );

  const filteredMaterials = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return mockMaterials.filter((m) => {
      return (
        q.length === 0 ||
        m.title.toLowerCase().includes(q) ||
        m.summary.toLowerCase().includes(q)
      );
    });
  }, [searchQuery]);

  async function copyPrompt() {
    if (!selectedPrompt) return;
    try {
      await navigator.clipboard.writeText(selectedPrompt.promptText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  function renderShell(children: ReactNode) {
    if (direction === "workspace") {
      return (
        <div className="dd-shell">
          <aside className="dd-sidebar" data-open={navOpen ? "true" : "false"}>
            <a className="dd-brand" href="#home">
              Портал знаний
            </a>
            <nav className="dd-nav" aria-label="Разделы">
              {mockNav.map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  aria-current={activeNav === item.id ? "page" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveNav(item.id);
                    setNavOpen(false);
                    if (item.id === "prompts") setScenario("prompts");
                    if (item.id === "video") setScenario("video");
                    if (item.id === "home") setScenario("home");
                  }}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </aside>
          <div className="dd-main">
            <header className="dd-topbar">
              <button
                type="button"
                className="dd-btn dd-btn-secondary dd-mobile-toggle"
                aria-expanded={navOpen}
                aria-controls="dd-workspace-nav"
                onClick={() => setNavOpen((v) => !v)}
              >
                Меню
              </button>
              <form
                className="dd-search"
                role="search"
                onSubmit={(e) => {
                  e.preventDefault();
                  setSearchOpen(true);
                  setScenario("home");
                }}
              >
                <label className="dd-sr-only" htmlFor={`dd-search-${direction}`}>
                  Поиск по порталу
                </label>
                <input
                  id={`dd-search-${direction}`}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  placeholder="Найти материал, промт, видео…"
                />
                <button type="submit" className="dd-btn">
                  Найти
                </button>
              </form>
            </header>
            <div className="dd-content">{children}</div>
          </div>
        </div>
      );
    }

    return (
      <div className="dd-shell">
        <header className="dd-topbar">
          <a className="dd-brand" href="#home">
            {direction === "learning" ? (
              <>
                <span className="dd-brand-mark" aria-hidden="true" />
                Портал знаний
              </>
            ) : (
              "Портал знаний"
            )}
          </a>
          <button
            type="button"
            className="dd-btn dd-btn-secondary dd-mobile-toggle"
            aria-expanded={navOpen}
            onClick={() => setNavOpen((v) => !v)}
          >
            Меню
          </button>
          <nav className="dd-nav" data-open={navOpen ? "true" : "false"} aria-label="Разделы">
            {mockNav.map((item) => (
              <a
                key={item.id}
                href={item.href}
                aria-current={activeNav === item.id ? "page" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveNav(item.id);
                  setNavOpen(false);
                  if (item.id === "prompts") setScenario("prompts");
                  if (item.id === "video") setScenario("video");
                  if (item.id === "home") setScenario("home");
                }}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </header>
        {direction === "learning" ? (
          <div className="dd-progress" aria-label="Прогресс обучения">
            <div className="dd-progress-label">Маршрут «Базовый ИИ» · 3 из 7 шагов</div>
            <div className="dd-progress-track">
              <div
                key={remountKey}
                className="dd-progress-fill dd-progress-anim"
                style={{ transform: "scaleX(1)" }}
              />
            </div>
          </div>
        ) : null}
        <div className="dd-content">{children}</div>
      </div>
    );
  }

  function renderHome() {
    return (
      <>
        <section className={direction === "learning" ? "dd-hero" : "dd-hero"} aria-labelledby="dd-home-title">
          <h1 id="dd-home-title" className="dd-display">
            {direction === "editorial"
              ? "Знания, которые читаются спокойно"
              : direction === "workspace"
                ? "Рабочее пространство знаний"
                : "Начните с понятного маршрута"}
          </h1>
          <p className="dd-lede">
            Демонстрационные данные прототипа ({MOCK_MARKER}). Найдите инструкцию,
            промт или видео — без регистрации.
          </p>
          {direction !== "workspace" ? (
            <form
              className="dd-search"
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                setSearchOpen(true);
              }}
            >
              <label className="dd-sr-only" htmlFor={`dd-home-search-${direction}`}>
                Быстрый поиск
              </label>
              <input
                id={`dd-home-search-${direction}`}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchOpen(true);
                }}
                placeholder="Например: бриф, отчёт, безопасность"
              />
              <button type="submit" className="dd-btn">
                Искать
              </button>
            </form>
          ) : null}
        </section>

        {searchOpen && searchQuery.trim() ? (
          <section aria-live="polite" className="dd-search-results">
            <h2 className="dd-section-title dd-display">Результаты поиска</h2>
            <p style={{ color: "var(--dd-color-muted-text)" }}>
              Найдено: {filteredMaterials.length}
            </p>
            <div className={direction === "editorial" ? "dd-list" : "dd-grid"}>
              {filteredMaterials.map((m) => (
                <MaterialCard
                  key={m.id}
                  material={m}
                  selected={selectedMaterialId === m.id}
                  compact={direction === "editorial"}
                  onSelect={() => {
                    setSelectedMaterialId(m.id);
                    setScenario("article");
                  }}
                />
              ))}
            </div>
          </section>
        ) : null}

        <section aria-labelledby="dd-dirs">
          <h2 id="dd-dirs" className="dd-section-title dd-display">
            Основные направления
          </h2>
          {direction === "learning" ? (
            <div className="dd-path-grid">
              {mockRoles.map((role) => (
                <article key={role.id} className="dd-path-card">
                  <strong>{role.title}</strong>
                  <p style={{ margin: 0, color: "var(--dd-color-muted-text)" }}>
                    {role.hint}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <div className={direction === "editorial" ? "dd-list" : "dd-grid"}>
              {mockRoles.map((role) =>
                direction === "editorial" ? (
                  <div key={role.id} className="dd-list-item">
                    <strong>{role.title}</strong>
                    <p style={{ margin: "0.35rem 0 0", color: "var(--dd-color-muted-text)" }}>
                      {role.hint}
                    </p>
                  </div>
                ) : (
                  <article key={role.id} className="dd-card">
                    <h3 className="dd-display">{role.title}</h3>
                    <p style={{ margin: 0, color: "var(--dd-color-muted-text)" }}>
                      {role.hint}
                    </p>
                  </article>
                ),
              )}
            </div>
          )}
        </section>

        <section aria-labelledby="dd-new">
          <h2 id="dd-new" className="dd-section-title dd-display">
            Новые и обновлённые
          </h2>
          <div className={direction === "editorial" ? "dd-list" : "dd-grid"}>
            {mockMaterials.map((m) => (
              <MaterialCard
                key={m.id}
                material={m}
                selected={selectedMaterialId === m.id}
                compact={direction === "editorial"}
                onSelect={() => {
                  setSelectedMaterialId(m.id);
                  setScenario(m.type === "video" ? "video" : "article");
                }}
              />
            ))}
          </div>
        </section>

        <section aria-labelledby="dd-prompts-home">
          <h2 id="dd-prompts-home" className="dd-section-title dd-display">
            Популярные промты
          </h2>
          <div className={direction === "editorial" ? "dd-list" : "dd-grid"}>
            {mockPrompts.slice(0, 2).map((p) => (
              <article
                key={p.id}
                className={direction === "editorial" ? "dd-list-item" : "dd-card"}
              >
                <h3 className="dd-display">{p.title}</h3>
                <p style={{ margin: 0, color: "var(--dd-color-muted-text)" }}>
                  {p.summary}
                </p>
                <p>
                  <button
                    type="button"
                    className="dd-btn dd-btn-secondary"
                    onClick={() => {
                      setSelectedPromptId(p.id);
                      setScenario("prompts");
                    }}
                  >
                    Смотреть промт
                  </button>
                </p>
              </article>
            ))}
          </div>
        </section>
      </>
    );
  }

  function renderArticle() {
    return (
      <article>
        <header>
          <p className="dd-meta">
            <span className="dd-chip">{mockArticle.category}</span>
            <span>Обновлено {mockArticle.updatedAtLabel}</span>
            <span>{mockArticle.audienceLabel}</span>
          </p>
          <h1 className="dd-display" style={{ marginTop: "0.75rem" }}>
            {mockArticle.title}
          </h1>
        </header>
        <div className="dd-article-layout">
          <nav className="dd-toc" aria-label="Оглавление">
            {mockArticle.toc.map((item) => (
              <a key={item} href={`#toc-${item}`}>
                {item}
              </a>
            ))}
          </nav>
          <div className="dd-prose">
            {mockArticle.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <h2 className="dd-display">Пошаговая инструкция</h2>
            {direction === "learning" ? (
              mockArticle.steps.map((step, i) => (
                <div key={step} className="dd-step-card">
                  <div className="dd-step-index" aria-hidden="true">
                    {i + 1}
                  </div>
                  <div>{step}</div>
                </div>
              ))
            ) : (
              <ol className="dd-steps">
                {mockArticle.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            )}
            <aside className="dd-callout" role="note">
              <strong>Важно. </strong>
              {mockArticle.info}
            </aside>
            <div className="dd-media-ph" role="img" aria-label="Изображение-заглушка схемы брифа">
              Схема брифа (заглушка)
            </div>
            <h2 className="dd-display">Связанный промт</h2>
            <pre className="dd-prompt">{mockArticle.promptPreview}</pre>
            <h2 className="dd-display">Связанные материалы</h2>
            <ul>
              {mockArticle.related.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <section aria-labelledby="dd-feedback">
              <h2 id="dd-feedback" className="dd-display">
                Обратная связь
              </h2>
              <p style={{ color: "var(--dd-color-muted-text)" }}>
                Материал был полезен?
              </p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button type="button" className="dd-btn dd-btn-secondary">
                  Да
                </button>
                <button type="button" className="dd-btn dd-btn-secondary">
                  Нужны правки
                </button>
              </div>
            </section>
          </div>
        </div>
      </article>
    );
  }

  function renderPrompts() {
    return (
      <>
        <header className="dd-toolbar">
          <h1 className="dd-display" style={{ margin: 0, flex: 1 }}>
            Библиотека промтов
          </h1>
          <button
            type="button"
            className="dd-btn dd-btn-secondary"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((v) => !v)}
          >
            Фильтры
          </button>
        </header>
        {filtersOpen ? (
          <div className="dd-filters" role="group" aria-label="Фильтры аудитории">
            {(["all", "managers", "specialists", "editors"] as const).map((a) => (
              <button
                key={a}
                type="button"
                className="dd-filter"
                aria-pressed={audienceFilter === a}
                onClick={() => setAudienceFilter(a)}
              >
                {a === "all" ? "Все" : audienceLabel[a]}
              </button>
            ))}
          </div>
        ) : null}
        <div
          className={direction === "workspace" ? "dd-admin" : undefined}
          style={
            direction !== "workspace"
              ? { display: "grid", gap: "1.25rem", marginTop: "1rem" }
              : { marginTop: "1rem" }
          }
        >
          <div>
            <div className={direction === "editorial" ? "dd-list" : "dd-grid"}>
              {mockPrompts
                .filter(
                  (p) =>
                    audienceFilter === "all" || p.audience === audienceFilter,
                )
                .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={direction === "editorial" ? "dd-list-item" : "dd-card"}
                  data-selected={selectedPromptId === p.id ? "true" : "false"}
                  onClick={() => setSelectedPromptId(p.id)}
                  style={{
                    textAlign: "left",
                    width: "100%",
                    cursor: "pointer",
                    border:
                      direction === "editorial"
                        ? undefined
                        : "1px solid var(--dd-color-border)",
                    background: "var(--dd-color-bg)",
                  }}
                >
                  <strong className="dd-display">{p.title}</strong>
                  <p style={{ margin: "0.35rem 0 0", color: "var(--dd-color-muted-text)" }}>
                    {p.summary}
                  </p>
                </button>
              ))}
            </div>
          </div>
          {selectedPrompt ? (
            <div>
              <h2 className="dd-display">{selectedPrompt.title}</h2>
              <p className="dd-meta">
                <span className="dd-chip">{selectedPrompt.category}</span>
                <span>{audienceLabel[selectedPrompt.audience]}</span>
              </p>
              <pre className="dd-prompt">{selectedPrompt.promptText}</pre>
              <p style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button type="button" className="dd-btn" onClick={() => void copyPrompt()}>
                  {copied ? "Скопировано" : "Копировать промт"}
                </button>
              </p>
              <h3 className="dd-display">Связанные инструкции</h3>
              <ul>
                {selectedPrompt.relatedGuides.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </>
    );
  }

  function renderVideo() {
    return (
      <article>
        <h1 className="dd-display">{mockVideo.title}</h1>
        <p style={{ color: "var(--dd-color-muted-text)" }}>{mockVideo.description}</p>
        <div
          className="dd-media-ph"
          role="region"
          aria-label={`Видеоплеер-заглушка, длительность ${mockVideo.durationLabel}`}
        >
          ▶ {mockVideo.durationLabel}
        </div>
        <h2 className="dd-display">Тайм-коды</h2>
        <ol>
          {mockVideo.chapters.map((c) => (
            <li key={c.time}>
              <button type="button" className="dd-btn dd-btn-secondary">
                {c.time} — {c.label}
              </button>
            </li>
          ))}
        </ol>
        <h2 className="dd-display">Расшифровка</h2>
        {mockVideo.transcript.map((line) => (
          <p key={line}>{line}</p>
        ))}
        <h2 className="dd-display">Связанные материалы</h2>
        <ul>
          {mockVideo.related.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </article>
    );
  }

  function renderAdmin() {
    return (
      <section aria-labelledby="dd-admin-title">
        <div className="dd-toolbar">
          <h1 id="dd-admin-title" className="dd-display" style={{ margin: 0, flex: 1 }}>
            Фрагмент конструктора
          </h1>
          <span className="dd-chip" aria-live="polite">
            {adminDirty ? "Есть изменения" : "Сохранено"}
          </span>
          <button type="button" className="dd-btn dd-btn-secondary">
            Предпросмотр
          </button>
          <button
            type="button"
            className="dd-btn"
            onClick={() => setAdminDirty(false)}
          >
            Опубликовать
          </button>
        </div>
        <div className="dd-admin">
          <div>
            <h2 className="dd-display">Блоки страницы</h2>
            {mockAdminBlocks.map((block) => (
              <button
                key={block.id}
                type="button"
                className="dd-admin-block"
                data-selected={adminSelected === block.id ? "true" : "false"}
                onClick={() => {
                  setAdminSelected(block.id);
                  setAdminDirty(true);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  marginBottom: "0.5rem",
                  cursor: "pointer",
                }}
              >
                <strong>{block.label}</strong>
                <div style={{ color: "var(--dd-color-muted-text)", fontSize: "0.85em" }}>
                  type: {block.type}
                </div>
              </button>
            ))}
          </div>
          <aside>
            <h2 className="dd-display">Добавить блок</h2>
            <div style={{ display: "grid", gap: "0.5rem" }}>
              {["heading", "paragraph", "image", "info", "steps", "prompt"].map(
                (type) => (
                  <button
                    key={type}
                    type="button"
                    className="dd-btn dd-btn-secondary"
                    onClick={() => setAdminDirty(true)}
                  >
                    + {type}
                  </button>
                ),
              )}
            </div>
          </aside>
        </div>
      </section>
    );
  }

  const body =
    scenario === "home"
      ? renderHome()
      : scenario === "article"
        ? renderArticle()
        : scenario === "prompts"
          ? renderPrompts()
          : scenario === "video"
            ? renderVideo()
            : renderAdmin();

  return (
    <div className="dd-root" data-direction={direction} data-mock={MOCK_MARKER}>
      <div className="dd-scenario-bar" role="toolbar" aria-label="Сценарии прототипа">
        {(Object.keys(SCENARIO_LABELS) as PrototypeScenario[]).map((id) => (
          <button
            key={id}
            type="button"
            className="dd-scenario-btn"
            aria-pressed={scenario === id}
            onClick={() => setScenario(id)}
          >
            {SCENARIO_LABELS[id]}
          </button>
        ))}
      </div>
      {renderShell(body)}
    </div>
  );
}
