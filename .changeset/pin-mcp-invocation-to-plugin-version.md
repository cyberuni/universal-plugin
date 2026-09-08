---
"universal-plugin": minor
---

`plugin build` stamps the plugin's version onto an MCP invocation that asks for it.

A plugin whose MCP server is its own npm package writes `{"command": "npx", "args": ["-y",
"my-server", "mcp"]}`, and nothing pins it: a consumer on 1.4.0 gets 1.4.0's skills and whatever
`npx` resolves as latest for the server, so skills and server drift apart silently. The version is
known at build time and nowhere else — `mcp.json` expands only `${PLUGIN_ROOT}` and `${PLUGIN_DATA}`,
so a runtime placeholder would reach the client literally.

An `mcpServers` entry now opts in with `"pinToPluginVersion": true`, and the build rewrites that
entry's package specifier to `<pkg>@<manifest version>`. Opt-in is required and a name match is never
used — a plugin may publish its server under a package name that is not the plugin's, and
`npx -y widget-cli` must never be stamped with this plugin's version. The marker is a build
directive, so it is stripped from every derived manifest and derived MCP file; the authored
`plugin.json` and `mcp.json` are left as written. Delivery follows the hooks rule: with nothing
marked, the declaration passes through and nothing is derived; with an entry marked, the pinned map
is delivered inline when the canonical declared it inline, else as `<vendor-dir>/mcp.json` with the
vendor's `mcpServers` repointed there.
