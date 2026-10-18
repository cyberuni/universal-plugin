---
'universal-plugin': minor
---

`marketplace init` and `marketplace add` now write each runtime only the entry sources it installs. Codex takes `path npm url git-subdir`, Copilot CLI `path github url`, and Cursor `path github url git-subdir`. A `github` source becomes a `url` (or `git-subdir`) entry for Codex, and a `git-subdir` on GitHub becomes `github` plus `path` for Copilot CLI, with `ref` and `sha` kept. Entries that cannot be mapped are omitted with a warning naming the entry and the runtime, because one `npm` or `git-subdir` entry makes Copilot CLI refuse the whole marketplace. Copilot CLI and Cursor read the Claude catalog when they have none of their own, so their catalogs are now written whenever the Claude one holds an entry they cannot install. `marketplace validate` reports unsupported sources, including in the Claude catalog for a runtime that falls back to it. The README install section lists which plugins each runtime cannot install.
