"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import type { DesignDirectionId } from "./types";
import { DESIGN_DIRECTIONS } from "./types";

import "./proto-picker.css";

type ProtoPickerProps = {
  activeId: DesignDirectionId;
  onChange: (id: DesignDirectionId) => void;
  onReplay: () => void;
};

export function ProtoPicker({ activeId, onChange, onReplay }: ProtoPickerProps) {
  const pickerRef = useRef<HTMLElement | null>(null);
  const highlightRef = useRef<HTMLSpanElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [ready, setReady] = useState(false);

  const activeIndex = DESIGN_DIRECTIONS.findIndex((d) => d.id === activeId);

  const moveHighlight = useCallback(() => {
    const el = itemRefs.current[activeIndex];
    const highlight = highlightRef.current;
    if (!el || !highlight) return;
    highlight.style.width = `${el.offsetWidth}px`;
    highlight.style.transform = `translateX(${el.offsetLeft}px)`;
  }, [activeIndex]);

  useLayoutEffect(() => {
    moveHighlight();
  }, [moveHighlight, activeId]);

  useEffect(() => {
    const onResize = () => moveHighlight();
    window.addEventListener("resize", onResize);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setReady(true));
    });
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(id);
    };
  }, [moveHighlight]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const num = Number.parseInt(e.key, 10);
      if (num >= 1 && num <= DESIGN_DIRECTIONS.length) {
        const next = DESIGN_DIRECTIONS[num - 1];
        if (next) onChange(next.id);
        return;
      }
      if (e.key === "ArrowRight") {
        const next =
          DESIGN_DIRECTIONS[(activeIndex + 1) % DESIGN_DIRECTIONS.length];
        if (next) onChange(next.id);
      } else if (e.key === "ArrowLeft") {
        const next =
          DESIGN_DIRECTIONS[
            (activeIndex - 1 + DESIGN_DIRECTIONS.length) %
              DESIGN_DIRECTIONS.length
          ];
        if (next) onChange(next.id);
      } else if (e.key === "r" || e.key === "R") {
        onReplay();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeIndex, onChange, onReplay]);

  return (
    <nav
      ref={pickerRef}
      className="proto-picker"
      aria-label="Prototype variants"
      data-ready={ready ? "" : undefined}
      data-position="top"
    >
      <span
        ref={highlightRef}
        className="proto-picker-highlight"
        aria-hidden="true"
      />
      {DESIGN_DIRECTIONS.map((direction, index) => (
        <button
          key={direction.id}
          type="button"
          className="proto-picker-item"
          ref={(node) => {
            itemRefs.current[index] = node;
          }}
          data-active={direction.id === activeId ? true : undefined}
          aria-current={direction.id === activeId ? "true" : undefined}
          onClick={() => onChange(direction.id)}
        >
          {direction.name.split(" ")[0]}
        </button>
      ))}
      <span className="proto-picker-divider" aria-hidden="true" />
      <button
        type="button"
        className="proto-picker-item proto-picker-replay"
        aria-label="Replay animation (R)"
        onClick={onReplay}
      >
        ↻
      </button>
    </nav>
  );
}
