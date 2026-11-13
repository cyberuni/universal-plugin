---
'universal-plugin': patch
---

Fix every command, `plugin build` included, crashing on Windows with `ERR_UNSUPPORTED_ESM_URL_SCHEME`: the `universal-plugin` launcher now imports the CLI by `file://` URL instead of by absolute path.
