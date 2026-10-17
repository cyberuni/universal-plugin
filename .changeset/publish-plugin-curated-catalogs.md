---
'universal-plugin': patch
---

`publish-plugin` now checks whether the target marketplace takes pull requests at all. With only read access, it reads the target's workflows and Contributing section live; for a curated catalog that closes outside PRs or takes submissions by form, it drafts the entry in that catalog's own shape and hands over the submission link instead of opening a PR.
