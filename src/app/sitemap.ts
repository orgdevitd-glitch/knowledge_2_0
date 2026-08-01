import type { MetadataRoute } from "next";

import { getContentSourceMode, getSiteUrl } from "@/config/env";
import { getPublicContentSource } from "@/server/composition/public-content";
import { filterPublished } from "@/features/public-content/visibility";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  if (!siteUrl) {
    return [];
  }

  const entries: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/materials`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/articles`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/prompts`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/search`, changeFrequency: "monthly", priority: 0.4 },
  ];

  // Never include demo-only content when empty; when demo (dev) still only published.
  if (getContentSourceMode() === "empty") {
    return entries;
  }

  const catalog = await getPublicContentSource().loadCatalog();
  for (const article of filterPublished(catalog.articles)) {
    entries.push({
      url: `${siteUrl}/articles/${article.slug}`,
      lastModified: article.updatedAt,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }
  for (const prompt of filterPublished(catalog.prompts)) {
    entries.push({
      url: `${siteUrl}/prompts/${prompt.slug}`,
      lastModified: prompt.updatedAt,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }
  return entries;
}
