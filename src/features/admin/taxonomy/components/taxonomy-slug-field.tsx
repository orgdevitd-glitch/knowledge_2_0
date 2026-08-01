"use client";

import { useState } from "react";

import { Input } from "@/components/ui";
import { slugifyTitle } from "@/features/admin/articles/slug";

export type TaxonomySlugFieldProps = {
  title: string;
  slug: string;
  onTitleChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  titleError?: string;
  slugError?: string;
  disabled?: boolean;
};

export function TaxonomySlugField({
  title,
  slug,
  onTitleChange,
  onSlugChange,
  titleError,
  slugError,
  disabled,
}: TaxonomySlugFieldProps) {
  const [slugManual, setSlugManual] = useState(false);

  const handleTitleChange = (value: string) => {
    onTitleChange(value);
    if (!slugManual) {
      onSlugChange(slugifyTitle(value));
    }
  };

  return (
    <>
      <Input
        label="Название"
        required
        value={title}
        disabled={disabled}
        onChange={(e) => handleTitleChange(e.target.value)}
        error={titleError}
      />
      <Input
        label="Slug (URL)"
        required
        value={slug}
        disabled={disabled}
        onChange={(e) => {
          setSlugManual(true);
          onSlugChange(e.target.value);
        }}
        description="Латиница, цифры и дефисы"
        error={slugError}
      />
    </>
  );
}
