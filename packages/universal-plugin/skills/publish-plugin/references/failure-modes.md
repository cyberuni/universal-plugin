# Common failure modes

Read this when a publish step fails, or a listing it produced does not install.

| Problem | Fix |
|---|---|
| Hook events silently don't fire | Re-run `plugin build`; check its warnings for a handler type that vendor cannot run |
| Codex rejects manifest | `version` and `description` are required by Codex |
| PR rejected: missing source link | Add `homepage` or `repository` to plugin.json |
| Name conflict in marketplace | Check existing entries in each marketplace file first |
| Entry installs nothing after a release | The pin names a tag that was never pushed — 1e was skipped; release and push the tag first |
| A second listing of the same plugin appeared | It was added instead of updated — 2b was skipped; remove the duplicate and move the existing entry with `marketplace update` |
| Nothing to publish | 2b found every catalog at this version already; bump and release the plugin first if a new version was intended |
| Plugin loads but skills missing | Add `skills` array to the Claude Code marketplace entry |
| Entry installs nothing for a monorepo plugin | `source` was `url`/root-clone instead of `git-subdir` — redo 2c/2d with the plugin's actual repo-relative path |
| Install fails resolving a dependency | 2g was skipped — list the plain dependency in this marketplace, or allow the named marketplace in `allowCrossMarketplaceDependenciesOn` |
| `marketplace validate` fails after 2h | Fix the reported shape before opening the PR — do not open it while validation fails |
| PR closed automatically as soon as it opened | The target is curated — redo 0c and use its submission route instead of a PR |
| Entry's `repository`/`source.url` points at the marketplace repo | Step 0 role detection was skipped or overridden wrongly — re-check which repo the cwd is |
