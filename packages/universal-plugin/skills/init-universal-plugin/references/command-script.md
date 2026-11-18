# Add a command script

Set a skill up to run one command of the plugin's own CLI through a compiled script. Take this
route when the author adds a CLI command a skill runs, or when `doctor-universal-plugin` reports
`own-package-runner` or `runner-beside-script`. The decision behind it is
[ADR-0021](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/design/decisions/0021-skills-run-the-own-cli-through-compiled-scripts.md).

A compiled script is one committed, self-contained `.mjs` in the skill folder. It ships with a git
install and an npm install alike, and needs no `dist/`, no `PATH` and no `npx`. Launchers
(`bin/<name>`) were removed: only Claude Code puts a plugin's `bin/` on `PATH`.

## 1. Name the script

For a CLI `cli` and a command `x y`, the script is `skills/<skill>/scripts/cli-x-y.mjs`, in the skill
that runs the command. A skill folder can be linked or copied on its own, so a skill never calls a
script in another skill's folder. Two skills that run the same command each get a script.

## 2. Write the source

The source is a TypeScript or JavaScript file in the package, outside the skill, that runs only that
command with `process.argv.slice(2)` as its arguments. Import the command's own module, not the
CLI's root program: the root imports every command, and the script grows toward the full CLI. Keep
its tests in the package; the skill gets only the built file.

Ask the author where the source goes when the package has no convention for it. universal-plugin
keeps its own under `src/skill-scripts/`.

## 3. Declare the entry

Add the entry under `extensions["org.cyberuni.universal-plugin"].scripts` in `plugin.json`:

```json
{
  "extensions": {
    "org.cyberuni.universal-plugin": {
      "scripts": {
        "skills/<skill>/scripts/cli-x-y.mjs": { "source": "src/skill-scripts/cli-x-y.ts", "command": "x y" }
      }
    }
  }
}
```

The `command` puts the entry in the command map that every compiled script embeds, so a reference
to that command from another script renders as `node <path>`.

## 4. Build and read the size

Run `plugin build` through the `build-plugin` skill. Read the build's `scripts` rows and warnings:

- `compiled`: commit the `.mjs` with the source.
- `failed`: an import could not be inlined. Fix the source; a script that still imports a package is
  what this route exists to prevent.
- Over the 150 KB budget: the command is too large to compile. Leave the entry out, and have the
  skill call a pinned `pnpm exec <bin> x y`, then `npx -y <package>@<version> x y`.

## 5. Call it from the skill

Replace each runner line for the command in the skill with:

```bash
node <this skill's folder>/scripts/cli-x-y.mjs <args>
```

Write the call with `node`. Do not rely on a hashbang or an executable bit: Windows and a copy that
drops the file mode run neither. Drop the `npx` or `pnpm exec` fallback beside it. The committed
script is current whenever CI runs `plugin build --check`, so the fallback has nothing to recover.

## 6. Keep it current in CI

Make sure CI runs `universal-plugin plugin build --check`. It exits 1 when a script is `missing`,
`stale` or on another version. Run `doctor-universal-plugin` again; the two findings for the command
should be gone.
