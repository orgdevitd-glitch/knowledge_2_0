# Google Workspace limits

Central limits live in `src/server/google-workspace/limits.ts` (structural elements, blocks, table size, sheet rows/columns, cell length, warnings/errors, preview bytes, Drive page size, boundary depth).

Exceeding limits produces blocking errors or explicit warnings — silent truncation is forbidden.
