# Update a universal plugin

Change which vendors or components an existing plugin declares. Every path ends with a rebuild:

```bash
npx universal-plugin plugin build
```

## Add a vendor

1. Add the vendor id to `extensions["org.cyberuni.universal-plugin"].vendors` in root
   `plugin.json`, and add its key to `extensions["org.cyberuni.universal-plugin"].harnesses`.
2. Populate vendor-specific fields — see that vendor's [`vendors/<vendor>.md`](./vendors/).
3. If the vendor requires extra fields (`codex`: `version`, `description`), add them to the canonical
   top level first — the build fails loudly without them.
4. Rebuild for the new vendor: `plugin build --vendor <id>`.

## Remove a vendor

1. Remove the vendor id from `extensions["org.cyberuni.universal-plugin"].vendors` and its key from
   `harnesses`.
2. Delete the generated manifest at its output path. `copilot-cli` has none — removing it is a
   manifest edit and nothing else.

## Add or remove a component

1. Add or remove the component field under `extensions["org.cyberuni.universal-plugin"]` in root
   `plugin.json` (e.g. `"commands": "./commands/"`). [`standard.md`](./standard.md) has the component
   table and which runtimes each one reaches.
2. Scaffold or delete the corresponding files.
3. Rebuild to regenerate all vendor manifests.
