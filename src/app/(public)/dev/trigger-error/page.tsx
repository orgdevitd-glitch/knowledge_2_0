"use client";

import { useState } from "react";

/**
 * Development helper to exercise `error.tsx` via a client-side throw.
 * The route itself stays reachable only as a smoke tool; production builds
 * still ship a static shell, but the intentional throw happens on demand.
 */
export default function TriggerErrorPage() {
  const [shouldThrow, setShouldThrow] = useState(false);

  if (process.env.NODE_ENV !== "development") {
    return (
      <div className="page">
        <h1>Недоступно</h1>
        <p className="lede">Эта страница предназначена только для development.</p>
      </div>
    );
  }

  if (shouldThrow) {
    throw new Error("Intentional development error for Phase 1 boundary check");
  }

  return (
    <div className="page">
      <p className="eyebrow">Dev only</p>
      <h1>Проверка error boundary</h1>
      <p className="lede">
        Нажмите кнопку, чтобы вызвать ошибку рендера и проверить экран
        восстановления без показа стека пользователю.
      </p>
      <p>
        <button
          type="button"
          className="button"
          onClick={() => {
            setShouldThrow(true);
          }}
        >
          Вызвать ошибку
        </button>
      </p>
    </div>
  );
}
