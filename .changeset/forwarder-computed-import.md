---
"universal-plugin": patch
---

The CLI forwarder now runs `npx` when the bin builds its import path at run time, such as
``import(`../${out}/cli.js`)``. That path names no file the forwarder can check, so a git install
without build output ran the checkout and crashed. Write the bin's import as a literal to run the
checkout.
