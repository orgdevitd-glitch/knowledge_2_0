# Skills location

Project skills are installed by `npx skills` into:

`.agents/skills/`

That directory is the canonical copy (includes reference files and `LICENSE`).
Do not duplicate skill bodies here — update via:

```bash
npx skills@latest update -p
```

Cursor is registered as an install target for these project skills.
