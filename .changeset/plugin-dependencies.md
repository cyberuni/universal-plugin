---
'universal-plugin': minor
---

Declare plugin dependencies once, and let the build deliver them per vendor. A plugin says what it
needs under `extensions["org.cyberuni.universal-plugin"].dependencies` — an array of plugin names,
each optionally `@marketplace`-qualified or given as an object with a semver range or a commit sha.
Claude Code is the only runtime that reads a dependency, so its manifest carries the declaration and
the others are built without it, each drop named in a warning. The build stays green. A range written
into the string form is accepted by the runtime and then discarded, so the build warns once and names
the object form that is enforced (ADR-0013).
