# Update a universal plugin

Change which vendors or components an existing plugin declares. Every path ends with a rebuild:

```bash
node <this skill's folder>/scripts/universal-plugin.mjs plugin build
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

## Add, change, or remove a dependency

A dependency is another plugin this one needs. Declare the list once, in root `plugin.json`, at
`extensions["io.github.cyber-uni.plugin-manager"].dependencies`. That key is shared with
cyber-agentkit, which reads the same list to say whether the dependencies are installed. The build
turns it into Claude Code's `dependencies`, the one runtime that reads it
([`vendors/claude-code.md`](./vendors/claude-code.md#dependencies)).

```json
"extensions": {
  "io.github.cyber-uni.plugin-manager": {
    "dependencies": ["cyber-asana", "tracer@acme", { "name": "cyber-notion", "marketplace": "cyberuni", "version": "^0.9.0" }]
  },
  "org.cyberuni.universal-plugin": { "vendors": ["claude-code"] }
}
```

1. **Add.** Append the entry. Write `"<name>"` for a plugin in this plugin's own marketplace, and
   `"<name>@<marketplace>"` for one in another. Use the object form when the request names a version
   range or a commit: `{ "name", "marketplace", "version" }`, or `sha` in place of `version`. Never put
   a range in the string (`"tracer@acme@^1.0.0"`): Claude Code accepts it and then drops the range.
2. **Change.** Edit the entry in place. Moving to a range or a pin turns a string into the object
   form; dropping both turns it back into a string.
3. **Remove.** Delete the entry. Delete the `dependencies` key once the list is empty, and the
   `io.github.cyber-uni.plugin-manager` object once it holds nothing else.
4. **Move an older list.** A plugin built before that key carries its list at
   `extensions["org.cyberuni.universal-plugin"].dependencies`. When the request edits the list, move
   every entry to the new key and delete the old one, so the plugin declares one list. Say that you
   moved it.
5. Rebuild, then read `dependencies` in `.claude-plugin/plugin.json`: it lists each entry as
   declared. A build warning that names a dependency the refreshed marketplace catalog cannot
   resolve is the user's to settle; relay it.

A dependency in another marketplace installs only when the root marketplace allows it, in
`allowCrossMarketplaceDependenciesOn`. That is the `marketplace` skill's setting.
