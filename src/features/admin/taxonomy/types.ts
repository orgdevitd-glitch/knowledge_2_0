import type { TaxonomyUsageSummary } from "./application/taxonomy-usage-service";

export type AdminTaxonomyStatus = "active" | "archived";

export type AdminCategoryDto = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
  status: AdminTaxonomyStatus;
  revision: number;
  createdAt: string;
  updatedAt: string;
  depth?: number;
  childCount?: number;
  usageCount?: number;
};

export type AdminTagDto = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: AdminTaxonomyStatus;
  revision: number;
  createdAt: string;
  updatedAt: string;
  usageCount?: number;
};

export type AdminAudienceDto = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  sortOrder: number;
  status: AdminTaxonomyStatus;
  revision: number;
  createdAt: string;
  updatedAt: string;
  usageCount?: number;
};

export type TaxonomyDashboardSection = {
  activeCount: number;
  archivedCount: number;
  totalCount: number;
  usedCount: number;
  unusedCount: number;
};

export type TaxonomyDashboardDto = {
  categories: TaxonomyDashboardSection;
  tags: TaxonomyDashboardSection;
  audiences: TaxonomyDashboardSection;
};

export type AdminCategoryTreeNode = AdminCategoryDto & {
  depth: number;
  childCount: number;
  children: AdminCategoryTreeNode[];
};

export type { TaxonomyUsageSummary };
