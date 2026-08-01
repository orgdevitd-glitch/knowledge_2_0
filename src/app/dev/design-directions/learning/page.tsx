import type { Metadata } from "next";

import { DesignDirectionPage } from "@/prototypes/design-directions/DesignDirectionsHarness";

export const metadata: Metadata = {
  title: "Guided Learning · Phase 2A",
  robots: { index: false, follow: false },
};

export default function LearningDirectionRoute() {
  return <DesignDirectionPage direction="learning" />;
}
