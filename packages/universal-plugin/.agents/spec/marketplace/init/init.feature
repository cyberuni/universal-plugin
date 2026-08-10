@frozen
Feature: marketplace init — derive local marketplace metadata

  Background:
    Given an empty repository root

  # ── Target selection and discovery ──

  Scenario: default initialization generates the three catalog targets
    Given the root plugin.json has author "Ari"
    And its plugins directory contains eligible plugins "alpha" and "beta"
    When I run "universal-plugin marketplace init --root <root>"
    Then Claude Codex and Copilot catalog files exist
    And the result has a Cursor row with status "skipped-default"
    And the exit code is 0

  Scenario: the Claude catalog records marketplace ownership and local plugin sources
    Given the root plugin.json has author "Ari"
    And its plugins directory contains eligible plugins "alpha" and "beta"
    When I run "universal-plugin marketplace init --claude --root <root>"
    Then the Claude catalog has the root name and owner "Ari"
    And each Claude catalog plugin is an object with name and "./"-prefixed source fields
    And the exit code is 0

  Scenario: the Codex catalog records its display name and local availability policy
    Given the root plugin.json has author "Ari"
    And its plugins directory contains eligible plugins "alpha" and "beta"
    When I run "universal-plugin marketplace init --codex --root <root>"
    Then the Codex catalog has the root name and matching interface display name
    And each Codex catalog plugin has source source "local" and a "./"-prefixed path
    And each Codex catalog plugin has policy installation "AVAILABLE" and authentication "ON_INSTALL"
    And each Codex catalog plugin has category "Productivity"
    And the exit code is 0

  Scenario: the Copilot catalog records marketplace display metadata and local plugin sources
    Given the root plugin.json has author "Ari"
    And its plugins directory contains eligible plugins "alpha" and "beta"
    When I run "universal-plugin marketplace init --copilot --root <root>"
    Then the Copilot catalog has the root name owner "Ari" and matching display metadata
    And each Copilot catalog plugin is an object with name and "./"-prefixed source fields
    And the exit code is 0

  Scenario: explicit selectors generate exactly their union
    Given the root plugin.json has author "Ari"
    And its plugins directory contains eligible plugins "alpha" and "beta"
    When I run "universal-plugin marketplace init --claude --copilot --root <root>"
    Then Claude and Copilot catalog files exist
    And the Codex catalog file does not exist
    And the Cursor submission files do not exist
    And the exit code is 0

  Scenario: explicit Cursor selection creates only a local submission scaffold
    Given the root plugin.json has author "Ari"
    And its plugins directory contains eligible plugins "alpha" and "beta"
    When I run "universal-plugin marketplace init --cursor --root <root>"
    Then the Cursor submission JSON and Markdown files exist
    And the Markdown links the Cursor dashboard
    And the output states that no publication or provisioning occurred
    And the Claude Codex and Copilot catalog files do not exist
    And the exit code is 0

  Scenario: the Cursor submission JSON identifies the marketplace and dashboard
    Given the root plugin.json has author "Ari"
    And its plugins directory contains eligible plugins "alpha" and "beta"
    When I run "universal-plugin marketplace init --cursor --root <root>"
    Then the Cursor submission JSON has the root name owner "Ari" and dashboard "https://cursor.com/dashboard"
    And each Cursor submission plugin is an object with name and "./"-prefixed source fields
    And the exit code is 0

  Scenario: a missing default scan directory is an empty success
    Given the root plugin.json has author "Ari"
    Given the repository root has no plugins directory
    When I run "universal-plugin marketplace init --root <root>"
    Then every default target has status "empty"
    And no catalog file is written
    And the exit code is 0

  Scenario: an out-of-root explicit scan directory fails before writes
    Given the root plugin.json has author "Ari"
    When I run "universal-plugin marketplace init --plugin-scan-dir ../outside --root <root>"
    Then the exit code is 1
    And stderr names "within --root"
    And no selected marketplace artifact is changed

  Scenario: a missing explicit scan directory fails before writes
    Given the root plugin.json has author "Ari"
    When I run "universal-plugin marketplace init --plugin-scan-dir extensions --root <root>"
    Then the exit code is 1
    And stderr names "does not exist"
    And no selected marketplace artifact is changed

  Scenario: an external scan-root symlink fails before writes
    Given the root plugin.json has author "Ari"
    And scan directory "extensions" is a symlink to a directory outside the repository root
    When I run "universal-plugin marketplace init --plugin-scan-dir extensions --root <root>"
    Then the exit code is 1
    And stderr names "within --root"
    And no selected marketplace artifact is changed

  Scenario: an external plugin-directory symlink fails before writes
    Given the root plugin.json has author "Ari"
    And plugins directory entry "alpha" is a symlink to a directory outside the repository root
    When I run "universal-plugin marketplace init --root <root>"
    Then the exit code is 1
    And stderr names "within --root"
    And no selected marketplace artifact is changed

  Scenario: an external candidate-manifest symlink fails before writes
    Given the root plugin.json has author "Ari"
    And plugins directory contains plugin "alpha" whose plugin.json is a symlink outside the repository root
    When I run "universal-plugin marketplace init --root <root>"
    Then the exit code is 1
    And stderr names "within --root"
    And no selected marketplace artifact is changed

  Scenario: repeated scan roots contribute their plugin union
    Given the root plugin.json has author "Ari"
    And scan directory "extensions-a" contains plugin "alpha"
    And scan directory "extensions-b" contains plugin "beta"
    When I run "universal-plugin marketplace init --claude --plugin-scan-dir extensions-a --plugin-scan-dir extensions-b --root <root>"
    Then the Claude catalog plugin names are "alpha" then "beta"
    And the exit code is 0

  Scenario: marketplace metadata uses the root name and author by default
    Given the root plugin.json has author "Ari"
    And its plugins directory contains eligible plugins "alpha" and "beta"
    When I run "universal-plugin marketplace init --claude --root <root>"
    Then the Claude catalog names the root directory and owner "Ari"
    And the exit code is 0

  Scenario: an object-form root author supplies the default owner
    Given the root plugin.json author object has name "Bea"
    And its plugins directory contains eligible plugins "alpha" and "beta"
    When I run "universal-plugin marketplace init --claude --root <root>"
    Then the Claude catalog owner is "Bea"
    And the exit code is 0

  Scenario: explicit marketplace metadata overrides the defaults
    Given its plugins directory contains eligible plugins "alpha" and "beta"
    When I run "universal-plugin marketplace init --claude --name team-catalog --owner Bea --root <root>"
    Then the Claude catalog names "team-catalog" and owner "Bea"
    And the exit code is 0

  Scenario: a missing marketplace owner fails before writes
    Given the root plugin.json has no author
    When I run "universal-plugin marketplace init --root <root>"
    Then the exit code is 1
    And stderr names "marketplace owner"
    And no selected marketplace artifact is changed

  Scenario: an invalid derived marketplace name fails before writes
    Given the repository root directory name is "not valid!"
    And the root plugin.json has author "Ari"
    When I run "universal-plugin marketplace init --root <root>"
    Then the exit code is 1
    And stderr names "marketplace name"
    And no selected marketplace artifact is changed

  Scenario: an invalid marketplace name override fails before writes
    Given the root plugin.json has author "Ari"
    When I run "universal-plugin marketplace init --name not-valid! --root <root>"
    Then the exit code is 1
    And stderr names "marketplace name"
    And no selected marketplace artifact is changed

  Scenario: a blank marketplace owner override fails before writes
    Given the root plugin.json has author "Ari"
    When I run "universal-plugin marketplace init --owner '   ' --root <root>"
    Then the exit code is 1
    And stderr names "marketplace owner"
    And no selected marketplace artifact is changed

  Scenario: only eligible plugin-root manifests become catalog entries
    Given the root plugin.json has author "Ari"
    Given the selected scan directory contains an ordinary plugin "gamma"
    And it contains vendor manifest directories with plugin.json files
    When I run "universal-plugin marketplace init --claude --plugin-scan-dir extensions --root <root>"
    Then the Claude catalog lists "gamma"
    And the "gamma" catalog source is "./extensions/gamma"
    And the Claude catalog lists no vendor-manifest plugin
    And the exit code is 0

  Scenario: a nested manifest is not a catalog candidate
    Given the root plugin.json has author "Ari"
    And its plugins directory contains eligible plugin "alpha"
    Given plugin "alpha" contains a nested plugin.json named "nested"
    When I run "universal-plugin marketplace init --claude --root <root>"
    Then the Claude catalog lists "alpha"
    And the Claude catalog does not list "nested"
    And the exit code is 0

  Scenario: catalog entries are name-sorted with root-relative sources
    Given the root plugin.json has author "Ari"
    Given the selected scan directory contains plugins "zeta" and "aardvark"
    When I run "universal-plugin marketplace init --claude --plugin-scan-dir extensions --root <root>"
    Then the Claude catalog plugin names are "aardvark" then "zeta"
    And every Claude catalog source starts with "./"
    And the exit code is 0

  Scenario: a malformed candidate manifest fails before writes
    Given the root plugin.json has author "Ari"
    And an eligible plugin manifest is malformed JSON
    When I run "universal-plugin marketplace init --root <root>"
    Then the exit code is 1
    And stderr names "valid JSON"
    And no selected marketplace artifact is changed

  Scenario: an invalid candidate name fails before writes
    Given the root plugin.json has author "Ari"
    And an eligible plugin manifest has name "not valid!"
    When I run "universal-plugin marketplace init --root <root>"
    Then the exit code is 1
    And stderr names "plugin name"
    And no selected marketplace artifact is changed

  Scenario: duplicate plugin identities fail before writes
    Given the root plugin.json has author "Ari"
    Given two eligible plugin manifests have the name "alpha"
    When I run "universal-plugin marketplace init --root <root>"
    Then the exit code is 1
    And stderr names "duplicate plugin name"
    And no selected marketplace artifact is changed

  # ── Planning and writes ──

  Scenario: dry run reports every selected artifact without writing it
    Given the root plugin.json has author "Ari"
    And its plugins directory contains eligible plugins "alpha" and "beta"
    When I run "universal-plugin marketplace init --claude --cursor --dry-run --root <root>"
    Then the Claude and Cursor result rows have status "planned"
    And no selected marketplace artifact is written
    And the exit code is 0

  Scenario: an equivalent rerun is unchanged
    Given the root plugin.json has author "Ari"
    And its plugins directory contains eligible plugins "alpha" and "beta"
    Given the selected catalog contains JSON equivalent to the generated Claude catalog
    When I run "universal-plugin marketplace init --claude --root <root>"
    Then the Claude result row has status "unchanged"
    And the exit code is 0

  Scenario: a differing selected artifact fails without changing any selected artifact
    Given the root plugin.json has author "Ari"
    And its plugins directory contains eligible plugins "alpha" and "beta"
    Given the Claude catalog differs from the generated content
    And the Copilot catalog differs from the generated content
    When I run "universal-plugin marketplace init --claude --copilot --root <root>"
    Then the exit code is 1
    And stderr names "--force"
    And the Claude and Copilot catalog contents are unchanged

  Scenario: force replaces only selected differing artifacts
    Given the root plugin.json has author "Ari"
    And its plugins directory contains eligible plugins "alpha" and "beta"
    Given the Claude catalog differs from the generated content
    And the Codex catalog differs from the generated content
    When I run "universal-plugin marketplace init --claude --force --root <root>"
    Then the Claude catalog contains the generated content
    And the Codex catalog contents are unchanged
    And the Claude result row has status "generated"
    And the exit code is 0

  Scenario: a selected-artifact write failure changes no selected artifact
    Given the root plugin.json has author "Ari"
    And its plugins directory contains eligible plugins "alpha" and "beta"
    Given selected Claude and Copilot catalogs contain differing existing content
    And the filesystem refuses the Copilot catalog replacement
    When I run "universal-plugin marketplace init --claude --copilot --force --root <root>"
    Then the exit code is 1
    And the Claude and Copilot catalog contents are unchanged

  Scenario: an external selected-output symlink fails before writes
    Given the root plugin.json has author "Ari"
    And its plugins directory contains eligible plugins "alpha" and "beta"
    And selected Claude output directory is a symlink to a directory outside the repository root
    When I run "universal-plugin marketplace init --claude --root <root>"
    Then the exit code is 1
    And stderr names "within --root"
    And no selected marketplace artifact is changed

  Scenario: an external selected-output file symlink fails before writes
    Given the root plugin.json has author "Ari"
    And its plugins directory contains eligible plugins "alpha" and "beta"
    And selected Claude marketplace.json is a symlink to a file outside the repository root
    When I run "universal-plugin marketplace init --claude --root <root>"
    Then the exit code is 1
    And stderr names "within --root"
    And no selected marketplace artifact is changed

  # ── Result rendering ──

  Scenario: default output is TOON and states the local-only boundary
    Given the root plugin.json has author "Ari"
    And its plugins directory contains eligible plugins "alpha" and "beta"
    When I run "universal-plugin marketplace init --root <root>"
    Then stdout is a TOON table with target status paths and plugins columns
    And stderr states that no marketplace publication registration installation authentication or provisioning occurred
    And the exit code is 0

  Scenario: JSON output exposes the result rows
    Given the root plugin.json has author "Ari"
    And its plugins directory contains eligible plugins "alpha" and "beta"
    When I run "universal-plugin marketplace init --format json --root <root>"
    Then stdout is JSON containing a result row with target status paths and plugins fields
    And stderr states that no marketplace publication registration installation authentication or provisioning occurred
    And the exit code is 0

  Scenario: an unsupported output format fails loud before writes
    When I run "universal-plugin marketplace init --format yaml --root <root>"
    Then the exit code is 1
    And stderr names "--format"
    And no selected marketplace artifact is changed
