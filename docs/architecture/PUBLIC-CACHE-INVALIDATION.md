# Public cache invalidation (Phase 5B)

## Port

`PublicContentInvalidationPort` in `src/server/content/public-invalidation.ts`.

## Next.js adapter

After publish / hide / archive (and slug-affecting public changes):

- `revalidatePath('/')`
- `revalidatePath('/materials')`
- `revalidatePath('/articles')`
- `revalidatePath('/articles/[slug]')` (+ previous slug if changed)
- `revalidatePath('/search')`
- `revalidatePath('/sitemap.xml')`
- Reset public content composition cache

Domain and use cases never import `next/cache`.
