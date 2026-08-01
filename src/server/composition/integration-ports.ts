import "server-only";

import {
  getGoogleWorkspaceConfig,
  getPersistenceMode,
  type GoogleWorkspaceConfig,
} from "@/config/env";
import { getContentPorts } from "@/server/composition/content-ports";
import {
  getGoogleWorkspaceClients,
  isGoogleWorkspaceEnabled,
} from "@/server/google-workspace/composition";
import { GoogleWorkspaceError } from "@/server/google-workspace/errors";
import { FirestoreSourceConnectionRepository } from "@/server/repositories/firestore/firestore-source-connection-repository";
import { FirestoreImportJobRepository } from "@/server/repositories/firestore/firestore-import-job-repository";
import { FirestoreIdempotencyRepository } from "@/server/repositories/firestore/firestore-idempotency-repository";
import { MemorySourceConnectionRepository } from "@/server/repositories/memory/memory-source-connection-repository";
import { MemoryImportJobRepository } from "@/server/repositories/memory/memory-import-job-repository";
import { MemoryIdempotencyRepository } from "@/server/repositories/memory/memory-idempotency-repository";
import type { IntegrationPorts } from "@/features/integrations/google/application/ports";
import type { GoogleWorkspaceClients } from "@/server/google-workspace/ports";

let memorySources: MemorySourceConnectionRepository | null = null;
let memoryJobs: MemoryImportJobRepository | null = null;
let memoryIdempotency: MemoryIdempotencyRepository | null = null;

export async function getIntegrationPorts(options?: {
  google?: GoogleWorkspaceClients;
  config?: GoogleWorkspaceConfig;
}): Promise<IntegrationPorts> {
  if (!isGoogleWorkspaceEnabled() && !options?.google) {
    throw new GoogleWorkspaceError(
      "GOOGLE_WORKSPACE_DISABLED",
      "Google Workspace integration is disabled",
    );
  }

  const google = options?.google ?? (await getGoogleWorkspaceClients());
  const content = getContentPorts();
  const config = options?.config ?? getGoogleWorkspaceConfig();
  const persistence = getPersistenceMode();

  if (persistence === "memory" || options?.google) {
    memorySources ??= new MemorySourceConnectionRepository();
    memoryJobs ??= new MemoryImportJobRepository();
    memoryIdempotency ??= new MemoryIdempotencyRepository();
    return {
      google,
      sources: memorySources,
      importJobs: memoryJobs,
      idempotency: memoryIdempotency,
      content,
      config,
    };
  }

  return {
    google,
    sources: new FirestoreSourceConnectionRepository(),
    importJobs: new FirestoreImportJobRepository(),
    idempotency: new FirestoreIdempotencyRepository(),
    content,
    config,
  };
}

export function resetIntegrationMemoryForTests(): void {
  memorySources = null;
  memoryJobs = null;
  memoryIdempotency = null;
}
