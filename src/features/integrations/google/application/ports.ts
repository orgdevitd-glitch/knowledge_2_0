import type { ContentPorts } from "@/features/content/application/ports";
import type { GoogleWorkspaceConfig } from "@/config/env";
import type { GoogleWorkspaceClients } from "@/server/google-workspace/ports";
import type { SourceConnectionRepository } from "@/server/repositories/interfaces/source-connection-repository";
import type { ImportJobRepository } from "@/server/repositories/interfaces/import-job-repository";
import type {
  IdempotencyRecord,
  IdempotencyRepository as IdempotencyRepositoryContract,
} from "@/server/repositories/interfaces/idempotency-repository";

export type { IdempotencyRecord };
export type IdempotencyRepository = IdempotencyRepositoryContract;

export type IntegrationPorts = {
  google: GoogleWorkspaceClients;
  sources: SourceConnectionRepository;
  importJobs: ImportJobRepository;
  idempotency: IdempotencyRepository;
  content: ContentPorts;
  config: GoogleWorkspaceConfig;
};
