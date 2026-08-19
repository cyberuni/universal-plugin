# Cursor

Reads `.cursor-plugin/plugin.json`. **The build derives it** — never hand-edit it.

```bash
npx universal-plugin plugin build --vendor cursor
```

## Extra requirements

None beyond `name`.

## Vendor-specific fields

Cursor's catalog metadata goes under its `harnesses` entry, not at the canonical top level:

```json
"cursor": {
  "publisher": "<org>",
  "category": "<category>",
  "tags": ["<tag>"]
}
```

## Skills

Cursor reads `SKILL.md` straight from the path the manifest's `skills` field names, and lets the user
invoke a skill by typing `/` and searching for it. **The build derives no per-skill artifact for
Cursor** — a mirrored `.cursor/commands/*.md` would be a second copy of the same body. Explicit-only
invocation is expressed natively through `disable-model-invocation`, which the build already writes
into the shared `SKILL.md`.

## Rules are Cursor-only

`rules/<name>.mdc` reaches Cursor and nothing else. Reach for a rule only when the plugin genuinely
needs always-on guidance in Cursor; anything a task can load on demand belongs in a skill, where every
runtime sees it. `governance show plugin-design` is the authority on that call.

`.mdc` and `.md` are not interchangeable, and path-scoping has no equivalent in the other runtimes —
never generate rules from a skill or a skill from a rule.

## Hooks

Cursor hook events are **camelCase** (`sessionStart`), and Cursor's hooks file differs in shape as
well as casing. The build derives `.cursor-plugin/hooks.json` from the canonical file — never author
it by hand. Cursor runs `command` and `prompt` handlers; an `http` or `agent` handler is dropped with
a warning. See [`claude-code.md`](./claude-code.md).

## Dependencies

Cursor reads no plugin dependency. A declaration is left out of `.cursor-plugin/plugin.json` with a
build warning. See [`claude-code.md`](./claude-code.md).
