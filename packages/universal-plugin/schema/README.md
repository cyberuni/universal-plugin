# Vendored schemas

`claude-code-marketplace.json` is the official Claude Code marketplace schema, fetched verbatim from
<https://json.schemastore.org/claude-code-marketplace.json> (the copy generated 2026-04-23) on
2026-08-19.

It ships nowhere: `package.json` `files` does not list this directory. It exists so
`src/marketplace/validation.schema.test.ts` can hold this project's catalog rules against the
runtime's own schema without reaching the network in a test, and so a re-fetch is a reviewable diff.
Re-fetch it when Claude Code's catalog shape moves, then run the tests.
