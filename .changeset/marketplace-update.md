---
'universal-plugin': minor
---

Add `marketplace update <name>`, which changes one entry a repository's catalogs already list and keeps every field it is not asked to change. Move an entry to a new source (a new git source keeps the old pin), bump `--ref` or `--sha`, set one field such as `--description` or `--category`, or remove one with `--unset`. Each catalog is validated before anything is written, and an update that would introduce an issue writes nothing.
