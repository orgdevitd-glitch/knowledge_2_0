import type { ContentBlock } from "@/domain/content/blocks";
import type {
  PublicMaterialType,
  ReviewStatus,
} from "./public-types";

export type { PublicMaterialType, ReviewStatus };

export type TaxonomyOption = {
  id: string;
  slug: string;
  title: string;
  count: number;
};

export type MaterialSummary = {
  id: string;
  type: PublicMaterialType;
  slug: string;
  title: string;
  summary: string | null;
  category: { id: string; slug: string; title: string } | null;
  tags: { id: string; slug: string; title: string }[];
  audiences: { id: string; slug: string; title: string }[];
  updatedAt: string;
  publishedAt: string;
  reviewStatus: ReviewStatus;
  url: string;
};

export type TocItem = {
  id: string;
  level: 2 | 3 | 4;
  text: string;
  anchor: string;
};

export type ArticleDetail = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  metadata: {
    typeLabel: string;
    categories: { id: string; slug: string; title: string }[];
    audiences: { id: string; slug: string; title: string }[];
    tags: { id: string; slug: string; title: string }[];
    updatedAt: string;
    publishedAt: string;
    reviewStatus: ReviewStatus;
  };
  blocks: ContentBlock[];
  tableOfContents: TocItem[];
  relatedMaterials: MaterialSummary[];
  /** Resolved published prompts keyed by PromptId for prompt blocks. */
  promptLookup: Record<
    string,
    {
      id: string;
      slug: string;
      title: string;
      summary: string | null;
      promptText: string;
      url: string;
    }
  >;
  updatedAt: string;
  publishedAt: string;
  reviewStatus: ReviewStatus;
};

export type PromptDetail = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  promptText: string;
  inputRequirements: string | null;
  outputRequirements: string | null;
  restrictions: string | null;
  usageExample: string | null;
  metadata: {
    typeLabel: string;
    categories: { id: string; slug: string; title: string }[];
    audiences: { id: string; slug: string; title: string }[];
    tags: { id: string; slug: string; title: string }[];
    updatedAt: string;
    publishedAt: string;
    reviewStatus: ReviewStatus;
  };
  relatedMaterials: MaterialSummary[];
  updatedAt: string;
  publishedAt: string;
  reviewStatus: ReviewStatus;
};

export type SearchDocument = {
  id: string;
  type: PublicMaterialType;
  slug: string;
  url: string;
  title: string;
  summary: string | null;
  headings: string[];
  plainText: string;
  categories: string[];
  tags: string[];
  audiences: string[];
  updatedAt: string;
};

export type SearchHit = {
  document: SearchDocument;
  score: number;
  titleMatches: string[];
};

export type HomePageModel = {
  categories: TaxonomyOption[];
  audiences: TaxonomyOption[];
  recentMaterials: MaterialSummary[];
  recentPrompts: MaterialSummary[];
};

export type CatalogPageModel = {
  items: MaterialSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters: {
    type: PublicMaterialType | null;
    category: string | null;
    audience: string | null;
    sort: string;
    q: string | null;
  };
  typeOptions: TaxonomyOption[];
  categoryOptions: TaxonomyOption[];
  audienceOptions: TaxonomyOption[];
};
