# Source connections

`sourceConnections/{id}` stores Google file linkage metadata: provider, externalId, mimeType, target entity, status (`active|access-lost|unsupported|archived`), last known version/checksum/import time, revision.

No credentials or document bodies are stored. Archive does not delete Articles/Prompts or import history; new previews are blocked until reactivation via successful test.
