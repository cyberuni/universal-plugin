# Hook Event Support Survey Changes

## 2026-08-18

- Changed: Copilot CLI casing resolved — both casings are accepted, and the casing selects the payload
  format (camelCase native, PascalCase "VS Code compatible" with Claude matcher semantics). Cursor now
  supports `type: "prompt"` beside `command`. Added a plugin-manifest hook wiring section covering the
  field name, accepted values, default location, and file shape per vendor. Recorded the Codex docs
  move to learn.chatgpt.com.
- Why: issue #41 asked the build to translate hook event names per vendor, which requires knowing how
  each vendor's manifest wires hooks — the June survey covered events, not wiring — and re-verifying the
  medium-confidence Copilot casing claim.
- Material conclusion change: yes. Copilot CLI no longer needs camelCase translation, so a PascalCase
  canonical hooks file reaches Claude Code, Codex, and Copilot CLI unchanged and only Cursor is
  translated. The unrepresentable-handler set per vendor also changed: Cursor loses http and agent
  rather than everything but command.
- Trigger: issue #41 (translate hook event names per vendor)

## 2026-06-06

- Changed: Initial research record created
- Why: New research topic commissioned to understand hook lifecycle support across Tier 1 vendors
- Material conclusion change: n/a (initial)
- Trigger: User request to survey session-start, post-install, and sub-session-frequency hooks
