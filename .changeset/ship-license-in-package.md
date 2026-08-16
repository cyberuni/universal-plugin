---
"universal-plugin": patch
---

Ship the MIT license file in the package

`package.json` and `plugin.json` both declared `"license": "MIT"`, but no license
file existed, so the published tarball carried the declaration without the terms
and the readme's license link pointed at a file that was never there.
