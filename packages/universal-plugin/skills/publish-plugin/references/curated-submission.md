# Draft a submission for a curated marketplace

Read this when Step 0c finds the target takes no pull requests from outsiders: submission is
form-only, or a workflow closes outside pull requests automatically. **Do not open a PR**, and do not
clone, fork, branch, or push. Draft the submission instead:

- Run Step 1's pre-flight as usual.
- Resolve dependencies (2g) against the target's **live** catalog, read from its default branch. A
  plain dependency the catalog does not list cannot be added through a form, so tell the user it
  will not resolve there.
- Write the entry in the shape the catalog's existing entries use, not the shape in 2d. For example,
  when existing entries pin `git-subdir` sources with `ref` and `sha`, use the plugin's release tag
  and that tag's commit.
- When the catalog already lists the plugin, run 2b against the live catalog too: at this version,
  report it and stop; at an older version, draft the changed pins and fields instead of a new entry.
- Hand the user the drafted entry and the submission link the target names. Skip Step 3.
