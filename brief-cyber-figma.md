# Mission: upgrade Changesets CLI v2 -> v3 in cyberuni/cyber-figma

## Repo
You are in a git worktree of cyberuni/cyber-figma, branched off its default branch. The primary checkout is at
`/home/unional/code/cyberuni/cyber-figma` — do NOT reach into it, do not touch its working tree, and do not commit to the default branch.
Work only in your own worktree. If the repo has `CLAUDE.md` / `AGENTS.md`, read it first; its
commit discipline binds you.

## FIRST, BEFORE ANYTHING ELSE: your base may be stale
The local clone this worktree came from can be behind origin. A sibling pod on another repo concluded
"this repo does not use Changesets", with internally consistent evidence, purely because its base
predated that repo's adoption of changesets. Do not repeat it.

    git fetch origin
    git log --oneline HEAD..origin/HEAD

If that is non-empty, rebase your branch onto the fetched default branch BEFORE reading anything.
Re-run it before you conclude "not applicable", "already on v3", or "nothing to fix" — those verdicts
are exactly the ones staleness fakes. State in your report which commit you verified against.

## Why this mission exists
The shared reusable release workflow in `cyberuni/.github` exists in TWO variants —
`pnpm-release-changeset.yml` and `pnpm-release-changeset-oidc.yml`. BOTH are on
`changesets/action@v2.1.0`, and both HARD-REFUSE Changesets CLI v2 with:

    Error: This version of the Changesets action is designed to work with Changesets CLI v3.
    Changesets CLI v2 is not supported; use Changesets action v1 instead, which is compatible with CLI v2.

cyberuni/cyber-figma calls one of those two variants (check which) and is still on CLI v2, so its release job goes red on the next push to
its default branch. It is armed, not yet red. 24 repos are in this state; you own this one.

The action bump was deliberate and must NOT be reverted: npm 12 changed `npm info --json` to emit an
array, CLI 2.x misreads it as "nothing published", and a v1/v2 release republishes into npm E403.
Pinning the action back to v1 is NOT an acceptable fix. Go forward to CLI v3.

## The reference fix (already proven in cyberuni/universal-plugin PR #35)
- `@changesets/cli` `^2.x` -> `^3.0.0` in root devDependencies
- `.changeset/config.json` `$schema` -> `https://unpkg.com/@changesets/config@4.0.0/schema.json`
- update the lockfile
No changeset file needed: root devDependency only, nothing in any published package changes. The
changeset-bot "No Changeset found" comment is expected and non-blocking.

## Verify these per-repo — they differ between repos, DO NOT assume this repo matches the reference
1. **Node floor.** Changesets v3 requires Node ^22.11. Check `engines`, `.nvmrc`, and the CI node
   matrix. If this repo tests on a node older than 22.11, the upgrade breaks it — that is a REAL
   BLOCKER. Report it, do not silently raise the repo's node floor to force the upgrade through.
2. **`prettier` key** in `.changeset/config.json` — removed in v3, replaced by `format`. If present,
   migrate it; check what actually formats this repo.
3. **`privatePackages`** — the default changed to opt-in in v3. If this repo has private packages in
   the workspace, confirm the new default does not change what gets versioned or published.
4. **Snapshots / prereleases** — if this repo uses either, verify the v3 behavior still matches.
5. **`changeset tag` and `--sinceMaster`** call sites — grep scripts and workflows; both changed.
6. **Pending changesets** — if `.changeset/*.md` files exist, prove they still parse under v3
   (`changeset status`), and ideally that a version dry run produces the expected bump. Revert any
   dry run before committing.

## Done looks like
- CLI on v3, config migrated, lockfile updated, repo's own verify/test/lint command green.
- PR opened against the default branch, all PR checks green.
- Conventional Commit (`fix(release):` fits). One concern per commit — nothing unrelated.
- If BLOCKED (node floor, or anything else), open no PR; report the blocker with evidence.

## Do not
- Do not touch the shared workflow or pin the action to v1.
- Do not fix any other repo — you own cyberuni/cyber-figma only.
- Do not merge your PR. That is the Council's call.

## Reporting
`npx cyberlegion@0.3.1 mail send --to operator --subject "cyber-figma: <one line>" --body "<PR url or BLOCKED+why, checks status, anything unusual>"`
Return address is the handle `operator` — the durable owner mailbox, use that and nothing else.
