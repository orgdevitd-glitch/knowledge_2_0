"use client";

import Link from "next/link";
import { useState } from "react";

import { DirectionView } from "./DirectionView";
import type { DesignDirectionId } from "./types";
import { DESIGN_DIRECTIONS } from "./types";

import "./direction-chrome.css";

export function ComparisonPage() {
  const [preview, setPreview] = useState<DesignDirectionId>("editorial");
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const meta = DESIGN_DIRECTIONS.find((d) => d.id === preview) ?? DESIGN_DIRECTIONS[0];

  return (
    <div style={{ padding: "1.5rem", maxWidth: "1200px", margin: "0 auto" }}>
      <p
        style={{
          font: "600 0.75rem/1.2 -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "#6b6b67",
        }}
      >
        Phase 2A · Design directions
      </p>
      <h1 style={{ fontSize: "1.75rem", margin: "0.5rem 0 0.75rem" }}>
        Сравнение визуальных направлений
      </h1>
      <p style={{ color: "#6b6b67", maxWidth: "42rem" }}>
        Три прототипа на одной палитре. Выбор направления — за вами; в production
        ничего не продвигается автоматически. Используйте picker на странице
        harness или отдельные URL.
      </p>

      <p style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <Link href="/dev/design-directions/play">Открыть picker harness</Link>
        {DESIGN_DIRECTIONS.map((d) => (
          <Link key={d.id} href={`/dev/design-directions/${d.id}`}>
            {d.name}
          </Link>
        ))}
      </p>

      <div
        role="tablist"
        aria-label="Направления"
        style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", margin: "1.5rem 0" }}
      >
        {DESIGN_DIRECTIONS.map((d) => (
          <button
            key={d.id}
            type="button"
            role="tab"
            aria-selected={preview === d.id}
            className="dd-scenario-btn"
            onClick={() => setPreview(d.id)}
          >
            {d.name}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <button
          type="button"
          className="dd-scenario-btn"
          aria-pressed={viewport === "desktop"}
          onClick={() => setViewport("desktop")}
        >
          Desktop
        </button>
        <button
          type="button"
          className="dd-scenario-btn"
          aria-pressed={viewport === "mobile"}
          onClick={() => setViewport("mobile")}
        >
          Mobile
        </button>
      </div>

      {meta ? (
        <section
          aria-labelledby="dd-meta-title"
          style={{
            border: "1px solid #e7e7e3",
            padding: "1rem",
            marginBottom: "1rem",
            background: "#f6f6f4",
          }}
        >
          <h2 id="dd-meta-title" style={{ marginTop: 0, fontSize: "1.15rem" }}>
            {meta.name}
          </h2>
          <p>
            <strong>Ось:</strong> {meta.axis}
          </p>
          <p>{meta.summary}</p>
          <p>
            <strong>Сильные стороны:</strong> {meta.strengths.join("; ")}
          </p>
          <p>
            <strong>Ограничения:</strong> {meta.limits.join("; ")}
          </p>
          <p>
            <strong>Лучше всего для:</strong> {meta.bestFor}
          </p>
        </section>
      ) : null}

      <div className="dd-viewport-frame" data-viewport={viewport}>
        <DirectionView key={`${preview}-${viewport}`} direction={preview} remountKey={0} />
      </div>
    </div>
  );
}
