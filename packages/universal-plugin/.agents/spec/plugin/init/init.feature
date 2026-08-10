@frozen
Feature: plugin init — scaffold a plugin project, and wire an npm package to ship it

  Background:
    Given a project root with no "plugin.json"

  # ── Scaffold the canonical manifest ──

  Scenario: writes the canonical plugin.json with a name
    When I run "universal-plugin plugin init --yes --root <root>"
    Then the exit code is 0
    And "plugin.json" is written at the project root
    And "plugin.json" contains a "name" field

  Scenario: --name sets the plugin name
    When I run "universal-plugin plugin init --name my-plugin --yes --root <root>"
    Then the exit code is 0
    And "plugin.json" contains name "my-plugin"

  Scenario: defaults the plugin name to the root directory name
    Given the project root directory is named "cool-plugin"
    When I run "universal-plugin plugin init --yes --root <root>"
    Then "plugin.json" contains name "cool-plugin"

  Scenario: --vendor records the vendor in the universal-plugin extensions namespace
    When I run "universal-plugin plugin init --vendor claude-code --vendor cursor --yes --root <root>"
    Then "plugin.json" has an "extensions" member "org.cyberuni.universal-plugin"
    And that member's "vendors" array contains "claude-code"
    And that member's "vendors" array contains "cursor"

  Scenario: without --vendor no vendors list is recorded
    When I run "universal-plugin plugin init --yes --root <root>"
    Then the exit code is 0
    And "plugin.json" is written at the project root
    And "plugin.json" declares no "vendors" list under the "org.cyberuni.universal-plugin" extensions member

  Scenario: --scaffold creates the standard directories
    When I run "universal-plugin plugin init --scaffold --yes --root <root>"
    Then the exit code is 0
    And directory "skills/" is created
    And directory "agents/" is created
    And directory "governances/" is created
    And directory "commands/" is created

  Scenario: without --scaffold only the manifest is written
    When I run "universal-plugin plugin init --yes --root <root>"
    Then "plugin.json" is written at the project root
    And directory "skills/" is NOT created

  Scenario: an existing manifest fails pointing at --force
    Given "plugin.json" already exists at the project root
    When I run "universal-plugin plugin init --yes --root <root>"
    Then the exit code is 1
    And stderr contains "already exists"
    And stderr contains "--force"

  Scenario: --force overwrites the existing manifest
    Given "plugin.json" already exists at the project root
    When I run "universal-plugin plugin init --force --yes --root <root>"
    Then the exit code is 0
    And "plugin.json" is overwritten

  Scenario Outline: init never prompts on any invocation
    When I run "universal-plugin plugin init <flags> --root <root>"
    Then no interactive prompt is shown
    And "plugin.json" is written at the project root
    And the exit code is 0

    Examples:
      | flags         | root   |
      |               | <root> |
      | --yes         | <root> |
      | --format json | <root> |

  Scenario: a successful run prints a TOON row per file plus the created aggregate
    When I run "universal-plugin plugin init --root <root>"
    Then stdout is TOON with one row per created file carrying "path"
    And stdout contains the aggregate summary "created 1"
    And the exit code is 0

  Scenario: --format json returns the created array
    When I run "universal-plugin plugin init --yes --format json --root <root>"
    Then the exit code is 0
    And stdout is valid JSON with a "created" array
    And the "created" array contains "plugin.json"

  Scenario: a successful run ends with the plugin build next-step line
    When I run "universal-plugin plugin init --root <root>"
    Then stderr ends with "→ add skills to skills/, then run universal-plugin plugin build"

  Scenario: an unknown flag fails loud
    When I run "universal-plugin plugin init --frobnicate --root <root>"
    Then the exit code is 1
    And stderr contains "--frobnicate"

  # ── Wire an npm package to ship the plugin ──

  Scenario: --npm defaults to wiring the claude-code manifest path
    Given a "package.json" at the project root
    When I run "universal-plugin plugin init --npm --root <root>"
    Then the exit code is 0
    And "package.json" "files" contains ".claude-plugin/plugin.json"
    And "package.json" "files" contains no other vendor manifest path

  Scenario: --npm wires each named vendor's derived manifest path
    Given a "package.json" at the project root
    When I run "universal-plugin plugin init --npm --vendor claude-code --vendor cursor --root <root>"
    Then "package.json" "files" contains ".claude-plugin/plugin.json"
    And "package.json" "files" contains ".cursor-plugin/plugin.json"
    And the exit code is 0

  Scenario: --npm wires the skills directory into files
    Given a "package.json" at the project root
    When I run "universal-plugin plugin init --npm --root <root>"
    Then "package.json" "files" contains "skills/"
    And the exit code is 0

  Scenario: --npm creates the files array when it is absent
    Given a "package.json" at the project root with no "files" field
    When I run "universal-plugin plugin init --npm --root <root>"
    Then "package.json" has a "files" array containing ".claude-plugin/plugin.json"
    And the exit code is 0

  Scenario: --npm preserves existing files entries and other fields
    Given a "package.json" at the project root with "files" containing "dist" and a "scripts" field
    When I run "universal-plugin plugin init --npm --root <root>"
    Then "package.json" "files" still contains "dist"
    And the "scripts" field is unchanged
    And the exit code is 0

  Scenario: re-running --npm adds nothing new
    Given a "package.json" at the project root already wired by a previous --npm run
    When I run "universal-plugin plugin init --npm --force --root <root>"
    Then "package.json" "files" contains ".claude-plugin/plugin.json" exactly once
    And the exit code is 0

  Scenario: --npm with no package.json fails before writing the manifest
    Given no "package.json" at the project root
    When I run "universal-plugin plugin init --npm --root <root>"
    Then the exit code is 1
    And stderr names the missing "package.json"
    And "plugin.json" is NOT written at the project root

  Scenario: without --npm the package.json is untouched
    Given a "package.json" at the project root with "files" containing "dist"
    When I run "universal-plugin plugin init --root <root>"
    Then "package.json" is unchanged
    And the exit code is 0

  Scenario: --npm reports package.json as updated in the result
    Given a "package.json" at the project root
    When I run "universal-plugin plugin init --npm --root <root>"
    Then stdout has a row for "package.json" with action "updated"
    And stdout contains an aggregate carrying the updated count
    And the exit code is 0

  # ── Print the command reference ──

  Scenario: --help prints a concise reference
    When I run "universal-plugin plugin init --help"
    Then the exit code is 0
    And stdout contains a synopsis, the flags, and one example
