import type { Clock } from "@/domain/shared/clock";
import type { IdGenerator } from "@/domain/shared/id-generator";
import type { AuditPort } from "@/server/repositories/interfaces/audit-port";
import type { ArticleRepository } from "@/server/repositories/interfaces/article-repository";
import type { PromptRepository } from "@/server/repositories/interfaces/prompt-repository";
import type { VideoRepository } from "@/server/repositories/interfaces/video-repository";
import type {
  AudienceRepository,
  CategoryRepository,
  TagRepository,
} from "@/server/repositories/interfaces/taxonomy-repository";
import type { VersionRepository } from "@/server/repositories/interfaces/version-repository";
import type { UnitOfWork } from "@/server/repositories/interfaces/unit-of-work";

export type UseCaseContext = {
  actorId: string;
  requestId: string;
  now?: string;
};

export type ContentPorts = {
  articles: ArticleRepository;
  prompts: PromptRepository;
  videos: VideoRepository;
  categories: CategoryRepository;
  tags: TagRepository;
  audiences: AudienceRepository;
  versions: VersionRepository;
  audit: AuditPort;
  clock: Clock;
  ids: IdGenerator;
  uow: UnitOfWork;
};
