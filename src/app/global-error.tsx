"use client";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * Replaces the root layout when it fails.
 * Must define its own <html> and <body>.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "#FFFFFF",
          color: "#010101",
          lineHeight: 1.5,
        }}
      >
        <main
          id="main-content"
          style={{
            maxWidth: "40rem",
            margin: "0 auto",
            padding: "3rem 1.25rem",
          }}
        >
          <p style={{ color: "#6B6B67", letterSpacing: "0.04em" }}>
            Критическая ошибка
          </p>
          <h1 style={{ fontSize: "1.75rem", margin: "0.5rem 0 1rem" }}>
            Приложение временно недоступно
          </h1>
          <p style={{ color: "#6B6B67" }}>
            Не удалось загрузить оболочку приложения. Повторите попытку позже.
          </p>
          {error.digest ? (
            <p style={{ color: "#6B6B67" }}>
              Код обращения: <code>{error.digest}</code>
            </p>
          ) : null}
          <p>
            <button
              type="button"
              onClick={reset}
              style={{
                background: "#F8BC03",
                color: "#010101",
                border: "1px solid #E7E7E3",
                padding: "0.5rem 1rem",
                cursor: "pointer",
                font: "inherit",
              }}
            >
              Повторить
            </button>
          </p>
        </main>
      </body>
    </html>
  );
}
