# Google Drive (Phase 6A)

Server Drive adapter lists and verifies files inside the configured Shared Drive and root folder boundary.

- `corpora=drive`, `driveId=<configured>`, `supportsAllDrives=true`
- Minimal metadata fields only
- Admin Drive browser: open root / nested folders, never above allowed root; filter by name; pagination
- Shortcuts are not auto-dereferenced
- Supported MIME for import: Google Docs, Sheets; folders for browsing

Boundary policy: `GoogleDriveBoundaryPolicy` walks parents with depth limit and cycle detection.
