# Taxonomy policy

## Statuses

`active` | `archived`

## Delete

Physical delete is forbidden. Use archive.

## Relationships

Material arrays (`categoryIds`, `tagIds`, `audienceIds`) are not rewritten on taxonomy archive/restore.

## Public filters

See ADR 0009: options appear when catalog usage count &gt; 0 (including archived legacy). Unknown slug filters fail closed.

## Sheets import

Resolver states: `resolved`, `unresolved`, `ambiguous`, `archived`.  
Taxonomy is never auto-created from a sheet. Confirmed ImportJobs are immutable.
