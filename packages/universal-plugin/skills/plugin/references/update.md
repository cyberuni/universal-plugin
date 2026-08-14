# Update a universal plugin

Change which vendors or components an existing plugin declares. Every path ends with a rebuild —
see [`create.md`](./create.md) Step 7.

## Add a vendor

1. Add the vendor id to `extensions["org.cyberuni.universal-plugin"].vendors` in root
   `plugin.json`, and add its key to `extensions["org.cyberuni.universal-plugin"].harnesses`.
2. Populate vendor-specific fields (see spec §3.3).
3. If the vendor requires extra fields (`codex`: `version`, `description`), ensure they are in the
   canonical section.
4. Rebuild for the new vendor.

## Remove a vendor

1. Remove the vendor id from `extensions["org.cyberuni.universal-plugin"].vendors` and its key from
   `harnesses`.
2. Delete the generated manifest at its output path.

## Add or remove a component

1. Add/remove the component field under `extensions["org.cyberuni.universal-plugin"]` in root
   `plugin.json` (e.g. `"commands": "./commands/"`).
2. Scaffold or delete the corresponding files.
3. Rebuild to regenerate all vendor manifests.
