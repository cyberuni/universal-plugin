---
"universal-plugin": patch
---

fix(forwarder): a git-sourced install with no build output now falls through to `npx -y <pkg>@<version>` instead of crashing with `ERR_MODULE_NOT_FOUND`. The forwarder runs a checkout only when its bin and every file the bin imports by a literal relative path exist. The stale-output warning now reads the output folder from those imports, such as `esm/`, and stays quiet when it can't tell ([#298](https://github.com/cyberuni/universal-plugin/issues/298)).
