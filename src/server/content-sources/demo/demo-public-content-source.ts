import "server-only";

import { loadDemoCatalog } from "./load-demo-catalog";
import type {
  PublicContentCatalog,
  PublicContentSource,
} from "../public-content-source";

/**
 * DEMO / development / test only.
 * Forbidden in production via CONTENT_SOURCE_MODE validation.
 */
export class DemoPublicContentSource implements PublicContentSource {
  readonly mode = "demo" as const;

  async loadCatalog(): Promise<PublicContentCatalog> {
    return loadDemoCatalog();
  }
}
