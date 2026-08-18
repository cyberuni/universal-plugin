# Move a universal plugin's version

Bump or set the version a plugin releases under, keeping every file that carries one in sync.

A plugin's version lives in up to five places, but only **two are authored** — the canonical root
`plugin.json` and, when the project declares a `packagePath`, that `package.json`. The per-vendor
manifests, the local marketplace catalogs, and the `npx`/`upx` pins inside `skills/**/SKILL.md` are
all **derived**. So never hand-edit a version: editing one file leaves the other authored file and
every derived artifact stale, and a consumer's plugin cache is keyed by version, so a content change
without a matching bump is invisible to them.

## Step 0 — Does this repo use changesets?

```bash
test -d .changeset && echo "changesets"
```

**If it does**, the version number is decided by changesets, not by you. Add a changeset and let the
release run — the repo's `version` script should already call `publish sync-version`, which carries
the released number from `package.json` into the canonical manifest:

```bash
npx universal-plugin publish sync-version
```

Do **not** run `plugin version` in a changesets repo — it would decide a number changesets is about
to decide again.

**If it does not**, `plugin version` is the whole release-number step. Continue below.

## Step 1 — Move the version

```bash
npx universal-plugin plugin version <bump>
```

`<bump>` is either a semver release type or an explicit version:

| `<bump>` | From `1.2.3` you get |
|---|---|
| `patch` | `1.2.4` |
| `minor` | `1.3.0` |
| `major` | `2.0.0` |
| `prerelease --preid beta` | `1.2.4-beta.0` |
| `2.0.0-rc.1` (explicit) | `2.0.0-rc.1` |

Useful flags:

| Flag | Effect |
|---|---|
| `--preid <id>` | Prerelease identifier for the `pre*` release types |
| `--dry-run` | Print the plan, write nothing — run this first when unsure |
| `--force` | Allow a target that does not advance on the current version |
| `--no-build` | Skip re-deriving the vendor manifests (you will run `plugin build` yourself) |
| `--format json` | Machine-readable result: `from`, `to`, `written` |

**Which release type?** That is the user's call, not the command's and not yours to guess — a
version is a promise to consumers about what broke. If the user has not said, ask, and offer the
semver reading of the change: breaking → `major`, new behavior → `minor`, fix only → `patch` (on a
`0.x` plugin, breaking → `minor` and everything else → `patch`).

## Step 2 — Confirm what moved

The command reports every file it wrote and every manifest it re-derived. Expect the canonical
manifest, the `packagePath` `package.json` if one is declared, and one derived manifest per declared
harness:

```bash
npx universal-plugin plugin version patch --format json
```

If the plugin declares no harnesses, only the authored files are written — that is correct, not a
failure.

## Guards

Every guard resolves before the first write, so a failed run leaves the tree untouched.

| Message names | What it means | Do this |
|---|---|---|
| a missing `plugin.json` | not at a plugin root, or the plugin was never scaffolded | `cd` to the plugin root, or see [`create.md`](./create.md) |
| no version to bump from | the manifest has never carried a `version` | pass an explicit version (`plugin version 0.1.0`) to set the first one |
| an unknown version or release type | the argument is neither a release type nor valid semver | use one of the values in the table above |
| a target that does not advance | the requested version is not greater than the current one | pick a higher version, or pass `--force` if the user genuinely wants to move backward |
| a missing `package.json` at `packagePath` | `.agents/universal-plugin.json` names a package directory that does not exist | fix `packagePath`, or create the package |

## Do not

- **Hand-edit a `version` field.** Two authored files and every derived artifact fall out of sync.
- **Write a derived manifest.** `.claude-plugin/plugin.json` and its siblings belong to
  `plugin build`; the bump already re-derived them.
- **Run `npm version`.** It knows only `package.json` and leaves the canonical manifest — the actual
  source of truth — stale.

## References

- Spec: https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/plugin/version/README.md
