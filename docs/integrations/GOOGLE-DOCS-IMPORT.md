# Google Docs import

Pipeline: Drive metadata → Shared Drive + root checks → Docs `documents.get` → normalize → checksum → ImportJob preview → admin confirm → Article draft use cases.

Mapping highlights:

- TITLE → proposed article title; HEADING_1→h2 … deeper capped at h4
- Paragraphs: bold, italic, safe links, line breaks
- Lists / tables / horizontal rule→divider; page break→divider
- Inline images → unsupported (no media library); footnotes/comments → warnings
- Unsafe links keep text, drop href

Confirm modes: metadata | blocks | both. Never auto-publish. Published articles only update working draft.
