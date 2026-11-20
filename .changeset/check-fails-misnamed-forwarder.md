---
"universal-plugin": patch
---

fix(build): a `scripts` entry the build refuses while reading it, such as a forwarder not named `<bin>.mjs`, now reports a `failed` row and fails `plugin build` and `plugin build --check`, where it was only warned about and dropped ([#304](https://github.com/cyberuni/universal-plugin/issues/304)).
