# Add a CLI forwarder

Set a skill up to run a CLI through a forwarding script. Take this route when a skill runs the
plugin's own CLI, or when `doctor-universal-plugin` reports `own-package-runner` or
`runner-beside-forwarder`. The decision behind it is
[ADR-0022](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/design/decisions/0022-skills-run-the-own-cli-through-a-forwarding-script.md).

A forwarder is one small committed `.mjs` in the skill folder, named after the CLI. It holds none of
the CLI's code and passes every argument through. In a checkout of the package it runs the
checkout's own bin with `node`, so testing a skill exercises the local change. Anywhere else (an
installed skill, a copied skill folder, a plugin cache) it runs `npx -y <package>@<version>`, with the
version `plugin build` wrote into it.

## 1. Declare the forwarder

Add one entry per skill that runs the CLI, under `extensions["org.cyberuni.universal-plugin"].scripts`
in `plugin.json`. For a bin `cli` of the plugin's own package (the `packagePath` `package.json`):

```json
{
  "extensions": {
    "org.cyberuni.universal-plugin": {
      "scripts": {
        "skills/<skill>/scripts/cli.mjs": { "forward": "cli" }
      }
    }
  }
}
```

The file name must be `<bin>.mjs`. A skill folder can be linked or copied on its own, so a skill never
calls a forwarder in another skill's folder: two skills that run the CLI each get one.

For a CLI that another package ships, name the package and pin its version:
`{ "forward": "other-cli", "package": "other-pkg", "version": "2.1.0" }`. `plugin version` leaves that
pin alone; move it by editing the entry.

## 2. Build

Run `plugin build` through the `build-plugin` skill, and commit the forwarder it writes. The own
form embeds `plugin.json`'s version. `plugin version` restamps it on each release, so no skill line
carries `@<version>`. A `failed` row names what is wrong with the entry.

## 3. Rewrite the skill's runner lines

Replace each line in the skill that runs the CLI through `npx`, `upx` or `pnpm exec`:

```bash
node <this skill's folder>/scripts/cli.mjs <args>
```

Keep the command and its arguments as they were; only the runner changes. Drop any fallback beside
the line: the forwarder already falls back to `npx`. Write the call with `node`. Do not rely on a
hashbang or an executable bit: Windows and a copy that drops the file mode run neither.

## 4. Keep it current

Make sure CI runs `universal-plugin plugin build --check`, which exits 1 when a forwarder is
`missing`, `stale` or on another version. The release must restamp it:

- **changesets:** `changeset version && universal-plugin plugin version`.
- **semantic-release:** have `@semantic-release/exec` run
  `universal-plugin plugin version ${nextRelease.version}` in `prepare`, and list the stamped files in
  `@semantic-release/git`'s `assets`.

Run `doctor-universal-plugin` again; the runner findings for the skill should be gone.
