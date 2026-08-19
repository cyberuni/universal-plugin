# doctor skill

Diagnose a universal agent plugin: what the canonical `plugin.json` declares, and whether what is on
disk still matches it for Claude Code, Cursor, Codex, and GitHub Copilot CLI.

## What it does

`scripts/doctor.mjs` composes the shipped CLI's `plugin build --dry-run --format json` with the
filesystem facts that build cannot see — whether each derived manifest exists, whether it predates
the canonical manifest, whether a stale or shadowing manifest is lying around, whether the two
authored version numbers still agree, and whether shipped content has moved since the version did. It emits one JSON object: `vendors`, `findings`, `ok`.

The skill supplies the judgment around it: which finding matters, and which skill owns its repair.

## It never repairs

Every finding names the skill that fixes it — `init` for anything that rewrites the manifest,
`version` for the release number, `remove-plugin` for artifacts. A repair can overwrite a manifest
the user maintains, and that judgment belongs to the skill that owns the write.

The script is read-only and exits `0` whether or not it finds anything, so it is safe to run
unattended, including from a session-start hook.

## Why a script rather than a checklist

The checks are deterministic: same tree, same findings. The one check that is not scriptable is the
definitive staleness test — rebuild on a clean tree and read the diff — because it writes. The skill
reports that one as a repair for the user to run.

Manifest validation is chartered as a CLI capability (`plugin validate`, specified but not yet
shipped). This script stays a thin composition on purpose, so it folds into that command rather than
competing with it.

## Boundaries

Diagnoses the plugin a project ships. A repository's own agent wiring — `.agents/skills/`,
`AGENTS.md`, per-harness bridges — is `buddy-agent-harness:doctor`.

## References

- [Spec](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/spec.md)
- [`plugin build`](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/plugin/build/README.md)
