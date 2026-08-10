# Task Plan

## Approach

Extend the canonical skill metadata with an invocation policy, then derive the
vendor-specific command surfaces inside the existing build pipeline. Lock the
behavior down with focused build tests and publish author guidance.

## Scope

- **In**: Invocation-policy parsing/defaults, vendor build artifacts, tests, governance, and release metadata.
- **Out**: A separate canonical `commands/` tree or changes to vendor runtime behavior.

## Action Items

- [x] Inspect the current build model, vendor writers, tests, and ADR constraints.
- [x] Add invocation-policy derivation and the Claude/Cursor/Codex outputs.
- [x] Add focused regression coverage and author governance.
- [x] Run formatting, typechecking, linting, tests, and build; review the diff.
- [x] Commit the verified feature.

## Open Questions

- None; issue #21 and ADR-0004 define the intended behavior.

---

## Review Section

_Complete after implementation_

### Summary

Added skill invocation policies, vendor-specific user-command derivation, and
author guidance for slash invocation.

### Verification

- [x] Tests pass
- [x] Linter clean
- [x] Build succeeds
- [x] Diff reviewed

### Lessons Captured

- [ ] Added to `tasks/lessons.md` (if corrections occurred)

---

## npm-distributed plugin migration

### Scope

- **In**: Move this repository's distributable plugin manifest, vendor manifests,
  public skills, and plugin agent under `packages/universal-plugin/`; update npm
  packaging and release-version synchronization; retain a reference to the
  Agent Plugins Specification.
- **Out**: Project-local `.agents/` skills and the repository marketplace draft.

### Action Items

- [x] Inventory the top-level plugin assets and their current distribution paths.
- [x] Relocate distributable plugin assets into `packages/universal-plugin/`.
- [x] Configure the package to ship the plugin assets and sync its manifest version.
- [x] Add the public `migrate-universal-plugin` skill and a reference to the Agent Plugins Specification.
- [x] Validate the packed npm tarball and the package test suite.
- [ ] Review and commit the focused migration.

### Review

- `pnpm --filter universal-plugin verify` — passed (331 tests).
- `npm pack --dry-run --json` from `packages/universal-plugin` — includes manifests, agent, and all public skills.
- `cyber-skills@0.7.0 audit validate` — no critical or high findings. Its one MEDIUM description-length warning is deferred because the project's current skill-description research specifies a 150–400 character target; this description is 392 characters.
