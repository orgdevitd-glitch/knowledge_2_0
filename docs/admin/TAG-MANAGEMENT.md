# Tag management

Tags are flat.

## Operations

- Create / edit title, slug, description
- Archive / restore

## Invariants

- Unique slug
- Unique normalized title (`trim` + case-fold + whitespace collapse)
- Archive keeps material links
- Archived tags are not offered for new article links

No merge-tags in Phase 7A.
