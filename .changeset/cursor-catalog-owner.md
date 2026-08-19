---
"universal-plugin": minor
---

`marketplace init` now writes Cursor the catalog it actually reads, and every catalog an `owner`
object.

Cursor's plugins reference documents `.cursor-plugin/marketplace.json` at the repository root, close
to Claude Code's shape. This project's research had recorded the opposite, so `--cursor` produced a
`.cursor-plugin/marketplace-submission.json` and a `CURSOR_MARKETPLACE_SUBMISSION.md` handoff. Both
are gone, replaced by the catalog. Cursor also joins the default target set, and the
`skipped-default` status it carried no longer exists.

`owner` was emitted as a string, which Claude Code rejects: `claude plugin validate` reports
`owner: Invalid input: expected object, received string`. It is now an object carrying `name`, plus
`email` and `url` when the canonical manifest's `author` supplies them. The Claude catalog also
carries a `$schema` key for editor completion and validation.
