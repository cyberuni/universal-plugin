---
"universal-plugin": minor
---

`plugin build` copies each governance into the skills that use it, so a skill reads its rule sets from disk instead of running `npx <pkg> governance show <name>` at run time — no registry lookup per read, and no network while the skill works. The `.md` files already in `<skill>/references/governances/` declare which governances that skill uses; the build rewrites each from the package that owns it, copies the governances those reference, transitively, and rewrites every `governance show <other>` pointer inside a copy into an instruction to load the sibling copy. The build fails when a declared file names no governance, when a referenced one has no copy to point at, or when `SKILL.md` does not list a copy under References. Commit the copies — a git-sourced install has no build step — and run the new `plugin build --check` in CI, which writes nothing and exits non-zero naming each copy that differs from its source.
