---
title: init-universal-plugin
description: Create a plugin, adopt an existing one onto the open standard, or change what it declares.
---

Fronts `plugin init` and `plugin build`. It creates a plugin, adopts an existing one onto the open
standard, or changes what an existing one declares. It is the only skill of the four that writes the
canonical `plugin.json`.

It runs five phases: survey, classify, confirm, apply, verify.

## The confirm phase

Adoption turns hand-written vendor manifests into build output, so the skill states the plan and
waits for approval before it rewrites anything you authored. Creating a file that does not exist yet
needs no approval.

## Adoption is lossless by contract

After the build, `git diff` over the vendor manifest paths should show formatting churn and nothing
else. A field that disappeared is a regression.

## See also

- [`plugin build`](../../cli/build/) — the command this skill drives
- [`doctor-universal-plugin`](../doctor-universal-plugin/) — diagnoses a plugin without writing anything
