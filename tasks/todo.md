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
