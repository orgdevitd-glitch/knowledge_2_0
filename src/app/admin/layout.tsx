import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-background)",
        color: "var(--color-foreground)",
      }}
    >
      <a href="#admin-main" className="ds-sr-only">
        Перейти к содержимому
      </a>
      <main id="admin-main">{children}</main>
    </div>
  );
}
