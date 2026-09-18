---
title: doctor-universal-plugin
description: Diagnose a plugin and repair nothing.
---

Fronts `plugin build --dry-run`. It diagnoses a plugin and repairs nothing: it reports what is
declared, unbuilt, stale, drifting, or shadowing, then names the skill that owns each repair.

## Output

The checks run as a script rather than a prose checklist, because they are deterministic. It emits
one JSON object:

```json
{
  "manifest": { "name": "my-plugin", "version": "1.0.0" },
  "vendors": [{ "vendor": "claude-code", "path": ".claude-plugin/plugin.json", "status": "built", "exists": true, "stale": false }],
  "findings": [{ "code": "unbuilt", "severity": "high", "detail": "…", "repair": "…" }],
  "ok": false
}
```

Exit status is `0` whether or not findings exist. A finding is a result, not a failure, so the
script is safe to run from a session-start hook.

## What it can't check inline

One check stays out of the script. Comparing a derived manifest against what the build would write
today requires rebuilding on a clean tree, and that writes. The skill reports it as a repair for you
to run.

One check reads git rather than the filesystem. A runtime keys its plugin cache on the version, so
content committed after the commit that set the current version never reaches anyone who already
installed the plugin. The skill reports that as `unreleased-content`. It stays quiet for a plugin
that declares `packagePath`, where the release moves the number, and on a tree with no history.

## See also

- [`init-universal-plugin`](../init-universal-plugin/) — owns the repairs this skill names
- [`plugin build`](../../cli/build/) — the command behind `--dry-run`
