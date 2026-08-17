import type { ReactNode } from "react";

import { Link } from "@/components/ui/Link";
import type { MetadataItem } from "@/components/ui";
import { taxonomyCatalogHref } from "../catalog-url";
import { PUBLIC_CONTENT_LIMITS } from "../limits";
import type { PublicTaxonomyRef } from "../read-models";

import styles from "./taxonomy-links.module.css";

const KIND_LABEL: Record<"category" | "tag" | "audience", string> = {
  category: "Категория",
  tag: "Тег",
  audience: "Аудитория",
};

export function TaxonomyRefList({
  refs,
  kind,
  maxVisible,
}: {
  refs: readonly PublicTaxonomyRef[];
  kind: "category" | "tag" | "audience";
  maxVisible?: number;
}) {
  if (refs.length === 0) return null;
  const visible =
    maxVisible == null ? refs : refs.slice(0, Math.max(0, maxVisible));
  const extra =
    maxVisible == null ? 0 : Math.max(0, refs.length - visible.length);
  const kindLabel = KIND_LABEL[kind];

  return (
    <ul className={styles.list}>
      {visible.map((ref) => {
        const href = taxonomyCatalogHref(kind, ref);
        const name = `${kindLabel}: ${ref.title}`;
        return (
          <li key={ref.id} className={styles.item}>
            {href ? (
              <Link href={href} className={styles.chip} aria-label={name}>
                {ref.title}
              </Link>
            ) : (
              <span className={styles.chipStatic} aria-label={`${name}, архив`}>
                {ref.title}
              </span>
            )}
          </li>
        );
      })}
      {extra > 0 ? (
        <li className={styles.item}>
          <span className={styles.overflow} aria-label={`Ещё ${extra}`}>
            +{extra}
          </span>
        </li>
      ) : null}
    </ul>
  );
}

export function CardTagList({ tags }: { tags: readonly PublicTaxonomyRef[] }) {
  return (
    <TaxonomyRefList
      refs={tags}
      kind="tag"
      maxVisible={PUBLIC_CONTENT_LIMITS.cardMaxVisibleTags}
    />
  );
}

export function taxonomyMetadataItems(input: {
  typeLabel: string;
  updatedLabel: string;
  categories: readonly PublicTaxonomyRef[];
  audiences: readonly PublicTaxonomyRef[];
  tags: readonly PublicTaxonomyRef[];
}): MetadataItem[] {
  const items: MetadataItem[] = [
    { label: "Тип", value: input.typeLabel },
    { label: "Обновлено", value: input.updatedLabel },
  ];
  if (input.categories.length > 0) {
    items.push({
      label: "Категория",
      value: <TaxonomyRefList refs={input.categories} kind="category" />,
    });
  }
  if (input.audiences.length > 0) {
    items.push({
      label: "Аудитория",
      value: <TaxonomyRefList refs={input.audiences} kind="audience" />,
    });
  }
  if (input.tags.length > 0) {
    items.push({
      label: "Теги",
      value: <TaxonomyRefList refs={input.tags} kind="tag" />,
    });
  }
  return items;
}

export function relatedMaterialsList(
  items: readonly { id: string; title: string; url: string }[],
): ReactNode {
  if (items.length === 0) return null;
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          <Link href={item.url}>{item.title}</Link>
        </li>
      ))}
    </ul>
  );
}
