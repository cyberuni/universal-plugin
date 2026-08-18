---
name: remove-plugin
description: Use this skill to remove a universal agent plugin's artifacts — delete the generated vendor manifests for Claude Code, Cursor, or Codex, clear a stale or shadowing manifest left by an older build, or take the whole plugin out of a project. Trigger on "delete the generated manifests", "remove the vendor manifests", "clean the plugin build output", "drop Codex support", "get rid of this plugin", or "stop shipping this plugin".
---

# Remove a plugin's artifacts

Three different removals live here, and they are not equally reversible. Establish which one is
being asked for before deleting anything.

| Ask | What it removes | Reversible by |
| --- | --- | --- |
| clean the build output | derived vendor manifests | `plugin build` |
| drop a vendor | one vendor's manifest, and its declaration | re-adding the vendor, then `plugin build` |
| remove the plugin | the canonical manifest and every component | nothing — confirm first |

## Clean the build output

Derived manifests are build artifacts. The build removes and rewrites them itself:

```bash
npx universal-plugin plugin build --clean
```

`--clean` deletes exactly what the manifest declares and nothing it does not, which is why it is the
supported route. To remove a derived manifest without rebuilding, delete that one path with the
user's own file tooling — `.claude-plugin/plugin.json`, `.cursor-plugin/plugin.json`, or
`.codex-plugin/plugin.json`. Name the path you are deleting before you delete it, and never widen
the deletion to the directory.

> **Never delete root `plugin.json`.** It is the canonical source of truth *and* the manifest
> Copilot CLI reads, so removing it takes out both the source and a live target at once.
> `copilot-cli` has no generated manifest to clean — nothing to delete is the correct state for it.

## Clear a stale or shadowing manifest

Two paths are worth checking whenever a plugin behaves as though it were an older version of itself:

- `.github/plugin/plugin.json` — written by older builds. It sits below root in Copilot CLI's search
  order, so it was never read, and it is no longer generated. Safe to delete.
- `.plugin/plugin.json` — this one **outranks** root in that search order. If it exists, Copilot CLI
  is reading it instead of the canonical manifest, and nothing regenerates it. Delete it, then
  rebuild and confirm Copilot CLI picks up root.

Copilot CLI's search order is `.plugin/plugin.json` → `plugin.json` → `.github/plugin/plugin.json` →
`.claude-plugin/plugin.json`, first match wins.

## Drop a vendor

Removing a vendor is a manifest edit first and a deletion second — deleting only the file leaves the
vendor declared, and the next build writes it straight back. That edit belongs to
`/universal-plugin:init`'s update route; come back here for the file.

## Remove the whole plugin

Irreversible. Confirm with the user before proceeding, and say specifically what goes:

- root `plugin.json`
- every derived manifest
- the component directories the manifest names (`skills/`, `commands/`, `agents/`, `hooks/`, …) —
  these hold authored content, not build output, so name them individually and get agreement on each

If the package's `package.json` `files` array was wired to ship the plugin (`plugin init --npm`),
that entry is now dead weight; remove it in the same change.

If the plugin was published, deleting the source does not unpublish it. Say so — consumers keep
resolving the last published version until it is deprecated at the registry, which is not something
this skill does.

## Rules

- **Confirm before any irreversible delete.** Cleaning build output is not irreversible; removing
  authored components is.
- **Never delete root `plugin.json` as cleanup.** Only as a deliberate, confirmed removal of the
  whole plugin.
- Prefer `plugin build --clean` over `rm` — it removes exactly what the manifest declares, and
  nothing it does not.
- A vendor left declared in `plugin.json` comes back on the next build. Edit the manifest, or the
  deletion is temporary.

## Related skills

| Task | Skill |
|------|-------|
| Remove a vendor from what the plugin declares | `init`, update route |
| Confirm what is stale, shadowing, or unbuilt before deleting | `doctor` |
| Take a published plugin out of a marketplace listing | `publish-plugin` |
