export function HeaderSearchForm({
  defaultQuery = "",
  action = "/search",
}: {
  defaultQuery?: string;
  action?: string;
}) {
  return (
    <form method="get" action={action} role="search" aria-label="Поиск по порталу">
      <label className="ds-sr-only" htmlFor="header-search-q">
        Поиск
      </label>
      <input
        id="header-search-q"
        type="search"
        name="q"
        defaultValue={defaultQuery}
        placeholder="Найти материал…"
        autoComplete="off"
        style={{
          width: "100%",
          minHeight: "2.5rem",
          padding: "0.4rem 0.75rem",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-control)",
          background: "var(--color-background)",
          font: "inherit",
        }}
      />
    </form>
  );
}
