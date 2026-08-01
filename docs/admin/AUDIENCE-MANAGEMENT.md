# Audience management

Audience is **content metadata**, not an authorization role.

## Operations

- Create / edit title, slug, description, sortOrder
- Reorder (`up` / `down` / `position`)
- Archive / restore

## Separation from auth

- Firebase Auth + admin allowlist decide who can administer
- Audience values never grant access
- Do not confuse with admin role `admin`
