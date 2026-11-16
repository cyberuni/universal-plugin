---
"universal-plugin": minor
---

`marketplace add` now names the metadata an entry still lacks. Each written row lists `missing`: the `description`, `homepage`, `repository`, `license`, and `keywords` that neither this machine nor a flag supplied. stderr names the flags that fill them. A git or npm spec reads nothing locally, so the note shows what to pass, and the command still fetches nothing (#264).
