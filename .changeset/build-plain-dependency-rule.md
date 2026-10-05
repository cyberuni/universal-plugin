---
"universal-plugin": minor
---

`plugin build` no longer warns about a dependency qualified with the catalog's own name, such as `cyber-asana@uip-pods-local`, when the catalog does not list it. Only a plain dependency (a bare name, or an object with no `marketplace`) has to be listed in the catalog. Naming a marketplace is an explicit choice by the author.
