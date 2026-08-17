import type { Metadata } from "next";

import { AdminShellChrome } from "@/features/admin/ui/admin-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AdminShellChrome>{children}</AdminShellChrome>;
}
