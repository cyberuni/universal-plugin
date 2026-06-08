# Plugin Design Governance Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure governance files so `plugin-design.md` ships with the npm package, `cli-command.md` moves to a project-private location, and `governance.ts` gains a new `local` scope for `<root>/.agents/governances`.

**Architecture:** Add a `local` scope to the existing five-scope governance resolution chain (`managed → project → local → user → package`). Move governance files to their canonical locations. No new abstractions — minimal changes to existing code.

**Tech Stack:** TypeScript, Node.js, vitest, tsdown, pnpm workspaces

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `packages/universal-plugin/src/governance/governance.ts` | Modify | Add `local` scope + `getLocalDir()` |
| `packages/universal-plugin/src/governance/governance.test.ts` | Modify | Tests for `local` scope behavior |
| `packages/universal-plugin/package.json` | Modify | Add `"governances"` to `files` array |
| `.plugin/plugin.json` | Modify | Remove stale `governances` field |
| `packages/universal-plugin/governances/plugin-design.md` | Create | Moved + updated from `governances/` |
| `.agents/governances/cli-command.md` | Create | Moved from `governances/` |
| `governances/plugin-design.md` | Delete | Moved to package scope |
| `governances/cli-command.md` | Delete | Moved to local scope |
| `.plugin/governances/plugin-design.md` | Delete | Stale duplicate |

---

### Task 1: Add `local` scope — failing tests

**Files:**
- Modify: `packages/universal-plugin/src/governance/governance.test.ts`

- [ ] **Step 1: Add failing tests for `getLocalDir` and `local` scope priority**

Open `packages/universal-plugin/src/governance/governance.test.ts`. Add these blocks after the existing `getProjectDir` describe block:

```ts
describe('getLocalDir', () => {
  it('returns <root>/.agents/governances', () => {
    expect(getLocalDir('/my/project')).toBe('/my/project/.agents/governances')
  })
})
```

And add this block inside the `showGovernance` describe, after the "project and user scope" test:

```ts
describe('Given a governance exists at local scope only', () => {
  it('When showing by name, Then returns content and scope=local', () => {
    const localFile = path.join(getLocalDir(ROOT), 'cli-command.md')
    const govFs = makeMockFs({ [localFile]: 'local content' })

    const result = showGovernance('cli-command', ROOT, govFs)

    expect(result!.scope).toBe('local')
    expect(result!.content).toBe('local content')
  })
})

describe('Given the same governance exists at project and local scope', () => {
  it('When showing by name, Then project scope wins', () => {
    const projectFile = path.join(getProjectDir(ROOT), 'plugin-design.md')
    const localFile = path.join(getLocalDir(ROOT), 'plugin-design.md')
    const govFs = makeMockFs({
      [projectFile]: 'project version',
      [localFile]: 'local version',
    })

    const result = showGovernance('plugin-design', ROOT, govFs)

    expect(result!.scope).toBe('project')
    expect(result!.content).toBe('project version')
  })
})

describe('Given the same governance exists at local and user scope', () => {
  it('When showing by name, Then local scope wins', () => {
    const localFile = path.join(getLocalDir(ROOT), 'plugin-design.md')
    const userFile = path.join(getUserDir(), 'plugin-design.md')
    const govFs = makeMockFs({
      [localFile]: 'local version',
      [userFile]: 'user version',
    })

    const result = showGovernance('plugin-design', ROOT, govFs)

    expect(result!.scope).toBe('local')
    expect(result!.content).toBe('local version')
  })
})
```

Also add to the `listGovernances` describe block a test that `local` scope appears:

```ts
describe('Given a governance exists at local scope', () => {
  it('When listing, Then returns entry with scope=local', () => {
    const localFile = path.join(getLocalDir(ROOT), 'cli-command.md')
    const govFs = makeMockFs({ [localFile]: 'content' })

    const entries = listGovernances(ROOT, govFs)

    expect(entries).toHaveLength(1)
    expect(entries[0]!.name).toBe('cli-command')
    expect(entries[0]!.scope).toBe('local')
  })
})
```

Also update the imports at the top of the test file to include `getLocalDir`:

```ts
import {
  getManagedDir,
  getPackageDir,
  getProjectDir,
  getLocalDir,
  getUserDir,
  listGovernances,
  showGovernance,
} from './governance.js'
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd packages/universal-plugin && pnpm exec vitest run src/governance/governance.test.ts
```

Expected: failures mentioning `getLocalDir is not a function` and `scope=local` not matching.

---

### Task 2: Implement `local` scope in `governance.ts`

**Files:**
- Modify: `packages/universal-plugin/src/governance/governance.ts`

- [ ] **Step 1: Update `Scope` type, add `getLocalDir`, update `getScopedPaths`**

In `packages/universal-plugin/src/governance/governance.ts`:

Replace:
```ts
export type Scope = 'managed' | 'project' | 'user' | 'package' | 'store'
```
With:
```ts
export type Scope = 'managed' | 'project' | 'local' | 'user' | 'package' | 'store'
```

Add `getLocalDir` after `getProjectDir`:
```ts
export function getLocalDir(root: string): string {
  return path.join(root, '.agents', 'governances')
}
```

Replace `getScopedPaths`:
```ts
export function getScopedPaths(root: string): ScopedPath[] {
  return [
    { scope: 'managed', dir: getManagedDir() },
    { scope: 'project', dir: getProjectDir(root) },
    { scope: 'local', dir: getLocalDir(root) },
    { scope: 'user', dir: getUserDir() },
    { scope: 'package', dir: getPackageDir() },
  ]
}
```

- [ ] **Step 2: Run tests to confirm they pass**

```bash
cd packages/universal-plugin && pnpm exec vitest run src/governance/governance.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Run full test suite and typecheck**

```bash
cd packages/universal-plugin && pnpm verify
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/universal-plugin/src/governance/governance.ts packages/universal-plugin/src/governance/governance.test.ts
git commit -m "feat(governance): add local scope for project-private governances"
```

---

### Task 3: Move `plugin-design.md` to package scope

**Files:**
- Create: `packages/universal-plugin/governances/plugin-design.md`
- Delete: `governances/plugin-design.md`

- [ ] **Step 1: Create the destination directory**

```bash
mkdir -p packages/universal-plugin/governances
```

- [ ] **Step 2: Copy the file**

```bash
cp governances/plugin-design.md packages/universal-plugin/governances/plugin-design.md
```

- [ ] **Step 3: Fix outdated reference in the moved file**

Open `packages/universal-plugin/governances/plugin-design.md`. Find and replace:

```
npx cyber-skills@<version> governance show
```

with:

```
npx universal-plugin@<version> governance show
```

The References section at the bottom currently reads:
```
npx cyber-skills@<version> governance show skill-design
npx cyber-skills@<version> governance show skill-repo-structure
npx cyber-skills@<version> governance show agent-tool-output
```

Replace with:
```
npx universal-plugin@<version> governance show skill-design
npx universal-plugin@<version> governance show skill-repo-structure
npx universal-plugin@<version> governance show agent-tool-output
```

- [ ] **Step 4: Do a full content review pass**

Read through `packages/universal-plugin/governances/plugin-design.md` and fix any other stale references (old package names, wrong paths, removed features). Common things to check:
- Any reference to `cyber-skills`, `uni-plugin`, or `cyber-universal-agent-plugin`
- Any path that references `./governances/` as if it were the source (it's now `package` scope, not `project`)
- Schema URI: verify `https://schema.cyberuni.dev/universal-agent-plugin/v1.json` still matches `.plugin/plugin.json#$schema`

- [ ] **Step 5: Delete the old file**

```bash
rm governances/plugin-design.md
```

- [ ] **Step 6: Commit**

```bash
git add packages/universal-plugin/governances/plugin-design.md governances/plugin-design.md
git commit -m "chore(governance): move plugin-design to package scope and fix stale references"
```

---

### Task 4: Move `cli-command.md` to local scope

**Files:**
- Create: `.agents/governances/cli-command.md`
- Delete: `governances/cli-command.md`

- [ ] **Step 1: Create destination directory and move file**

```bash
mkdir -p .agents/governances
cp governances/cli-command.md .agents/governances/cli-command.md
rm governances/cli-command.md
```

- [ ] **Step 2: Verify `.agents/` is not gitignored incorrectly**

```bash
git check-ignore -v .agents/governances/cli-command.md
```

Expected: no output (file is not ignored). If it is ignored, open `.gitignore` and ensure `.agents/governances/` is not covered by a blanket ignore rule.

- [ ] **Step 3: Commit**

```bash
git add .agents/governances/cli-command.md governances/cli-command.md
git commit -m "chore(governance): move cli-command to project-private .agents/governances"
```

---

### Task 5: Delete stale `.plugin/governances/plugin-design.md`

**Files:**
- Delete: `.plugin/governances/plugin-design.md`

- [ ] **Step 1: Delete the file**

```bash
rm .plugin/governances/plugin-design.md
```

- [ ] **Step 2: Remove the empty directory if nothing else is in it**

```bash
rmdir .plugin/governances 2>/dev/null || echo "directory not empty, leaving it"
```

- [ ] **Step 3: Commit**

```bash
git add .plugin/governances/plugin-design.md
git commit -m "chore: delete stale .plugin/governances/plugin-design.md"
```

---

### Task 6: Update `package.json` and `.plugin/plugin.json`

**Files:**
- Modify: `packages/universal-plugin/package.json`
- Modify: `.plugin/plugin.json`

- [ ] **Step 1: Add `governances` to npm files array**

Open `packages/universal-plugin/package.json`. The current `files` array is:
```json
"files": [
  "bin",
  "dist"
]
```

Change to:
```json
"files": [
  "bin",
  "dist",
  "governances"
]
```

- [ ] **Step 2: Remove `governances` from `.plugin/plugin.json`**

Open `.plugin/plugin.json`. The current `vendorExtensions.claude-code` is:
```json
"claude-code": {
  "governances": "./governances/",
  "assets": "./assets/"
}
```

Change to:
```json
"claude-code": {
  "assets": "./assets/"
}
```

- [ ] **Step 3: Run the full test suite to confirm nothing broke**

```bash
cd packages/universal-plugin && pnpm verify
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add packages/universal-plugin/package.json .plugin/plugin.json
git commit -m "chore: add governances to npm files; remove stale governances field from plugin.json"
```

---

## Verification

After all tasks complete, verify end-to-end:

```bash
# Build the package
cd packages/universal-plugin && pnpm build

# Confirm governance file is accessible via package scope
node -e "
import { getPackageDir } from './dist/cli.js'
" 2>/dev/null || echo "(getPackageDir not exported from CLI — check dist directly)"

ls packages/universal-plugin/governances/
```

Expected: `plugin-design.md` listed.

```bash
# Confirm .agents/governances is in place
ls .agents/governances/
```

Expected: `cli-command.md` listed.

```bash
# Confirm governances/ at root is empty or removed
ls governances/ 2>/dev/null || echo "governances/ directory removed"
```

Expected: empty or removed.
