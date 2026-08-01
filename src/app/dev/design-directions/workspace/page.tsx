import type { Metadata } from "next";

import { DesignDirectionPage } from "@/prototypes/design-directions/DesignDirectionsHarness";

export const metadata: Metadata = {
  title: "Structured Workspace · Phase 2A",
  robots: { index: false, follow: false },
};

export default function WorkspaceDirectionRoute() {
  return <DesignDirectionPage direction="workspace" />;
}
