---
"universal-plugin": patch
---

Fix stale and dangling references in the shipped skills and the agentskills-specialist agent: point skills at `doctor-universal-plugin`, link ADRs by URL, state current rules instead of migration-relative ones, and drop the project-specific commit and memory rules from the agent.
