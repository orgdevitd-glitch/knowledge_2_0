"use client";

import { useEffect } from "react";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Client boundary: do not log secrets or full stacks to the UI.
    // Server components that throw are logged via Next.js / server logger paths.
    console.error("Application error boundary", {
      digest: error.digest,
      name: error.name,
    });
  }, [error]);

  return (
    <div className="page">
      <p className="eyebrow">Ошибка</p>
      <h1>Что-то пошло не так</h1>
      <p className="lede">
        Произошла ошибка при отображении страницы. Попробуйте ещё раз. Если
        проблема повторяется, обратитесь к администратору портала.
      </p>
      {error.digest ? (
        <p className="muted">
          Код обращения: <code>{error.digest}</code>
        </p>
      ) : null}
      <p>
        <button type="button" className="button" onClick={reset}>
          Повторить
        </button>
      </p>
    </div>
  );
}
