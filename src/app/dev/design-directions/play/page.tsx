import type { Metadata } from "next";
import { Suspense } from "react";

import { DesignDirectionsHarness } from "@/prototypes/design-directions/DesignDirectionsHarness";

export const metadata: Metadata = {
  title: "Design directions picker · Phase 2A",
  robots: { index: false, follow: false },
};

export default function DesignDirectionsPlayPage() {
  return (
    <Suspense fallback={<p style={{ padding: "2rem" }}>Загрузка прототипов…</p>}>
      <DesignDirectionsHarness />
    </Suspense>
  );
}
