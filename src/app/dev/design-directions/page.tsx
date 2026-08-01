import type { Metadata } from "next";

import { ComparisonPage } from "@/prototypes/design-directions/ComparisonPage";

export const metadata: Metadata = {
  title: "Design directions · Phase 2A",
  robots: { index: false, follow: false },
};

export default function DesignDirectionsIndexPage() {
  return <ComparisonPage />;
}
