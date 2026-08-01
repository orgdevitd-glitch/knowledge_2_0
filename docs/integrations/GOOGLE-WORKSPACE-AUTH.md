# Google Workspace authentication

Phase 6A uses a **server-only** technical identity:

- Production: Cloud Run service account + Application Default Credentials
- Local: developer ADC or a service account configured outside the repository

Never store service account JSON keys in git or `.env`. Never send Google credentials or access tokens to the browser.

Mode:

- `GOOGLE_WORKSPACE_MODE=disabled` — integration UI shows unavailable; APIs return safe errors; portal works
- `GOOGLE_WORKSPACE_MODE=service-account` — requires Shared Drive ID and root folder ID

Read-only scopes only: `drive.readonly`, `documents.readonly`, `spreadsheets.readonly`.

See ADR 0008.
