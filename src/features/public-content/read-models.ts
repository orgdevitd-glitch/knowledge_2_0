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

/** Public taxonomy label. `id` is a React key only — never shown. */
export type PublicTaxonomyRef = {
  id: string;
  slug: string;
  title: string;
  status: "active" | "archived";
};

export type MaterialSummary = {
  id: string;
  type: PublicMaterialType;
  slug: string;
  title: string;
  summary: string | null;
  category: PublicTaxonomyRef | null;
  tags: PublicTaxonomyRef[];
  audiences: PublicTaxonomyRef[];
  updatedAt: string;
  publishedAt: string;
  reviewStatus: ReviewStatus | null;
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
    categories: PublicTaxonomyRef[];
    audiences: PublicTaxonomyRef[];
    tags: PublicTaxonomyRef[];
    updatedAt: string;
    publishedAt: string;
    reviewStatus: ReviewStatus | null;
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
  reviewStatus: ReviewStatus | null;
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
    categories: PublicTaxonomyRef[];
    audiences: PublicTaxonomyRef[];
    tags: PublicTaxonomyRef[];
    updatedAt: string;
    publishedAt: string;
    reviewStatus: ReviewStatus | null;
  };
  relatedMaterials: MaterialSummary[];
  updatedAt: string;
  publishedAt: string;
  reviewStatus: ReviewStatus | null;
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
    tag: string | null;
    audience: string | null;
    sort: string;
    q: string | null;
  };
  typeOptions: TaxonomyOption[];
  categoryOptions: TaxonomyOption[];
  tagOptions: TaxonomyOption[];
  audienceOptions: TaxonomyOption[];
};
