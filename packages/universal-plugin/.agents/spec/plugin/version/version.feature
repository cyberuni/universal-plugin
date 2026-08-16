@frozen
Feature: plugin version — move the plugin's version, and keep every version-carrying file in sync

  Background:
    Given a project root with a canonical "plugin.json"

  # ── Move the authored version ──

  Scenario: a patch bump moves the canonical manifest version
    Given the manifest version is "1.2.3"
    When I run "universal-plugin plugin version patch --root <root>"
    Then the exit code is 0
    And "plugin.json" contains version "1.2.4"

  Scenario: a minor bump zeroes the patch component
    Given the manifest version is "1.2.3"
    When I run "universal-plugin plugin version minor --root <root>"
    Then "plugin.json" contains version "1.3.0"

  Scenario: a major bump zeroes the minor and patch components
    Given the manifest version is "1.2.3"
    When I run "universal-plugin plugin version major --root <root>"
    Then "plugin.json" contains version "2.0.0"

  Scenario: an explicit version is used exactly as given
    Given the manifest version is "1.2.3"
    When I run "universal-plugin plugin version 2.0.0-rc.1 --root <root>"
    Then "plugin.json" contains version "2.0.0-rc.1"

  Scenario: --preid names the prerelease identifier
    Given the manifest version is "1.2.3"
    When I run "universal-plugin plugin version prerelease --preid beta --root <root>"
    Then "plugin.json" contains version "1.2.4-beta.0"

  Scenario: a prerelease bump increments the existing identifier
    Given the manifest version is "1.2.4-beta.0"
    When I run "universal-plugin plugin version prerelease --root <root>"
    Then "plugin.json" contains version "1.2.4-beta.1"

  Scenario: an explicit version seeds a manifest that has none
    Given the manifest has no "version" field
    When I run "universal-plugin plugin version 0.1.0 --root <root>"
    Then the exit code is 0
    And "plugin.json" contains version "0.1.0"

  Scenario: every other manifest field is preserved
    Given the manifest version is "1.2.3"
    And the manifest has a "name" and a "description"
    When I run "universal-plugin plugin version patch --root <root>"
    Then "plugin.json" still contains its original "name"
    And "plugin.json" still contains its original "description"

  Scenario: the canonical manifest keeps its own indentation
    Given the manifest version is "1.2.3"
    And "plugin.json" is indented with two spaces
    When I run "universal-plugin plugin version patch --root <root>"
    Then "plugin.json" is still indented with two spaces

  # ── Keep the npm package.json in lockstep ──

  Scenario: the packagePath package.json moves to the same version
    Given the manifest version is "1.2.3"
    And ".agents/universal-plugin.json" declares packagePath "packages/mypkg"
    And "packages/mypkg/package.json" exists at version "1.2.3"
    When I run "universal-plugin plugin version minor --root <root>"
    Then "plugin.json" contains version "1.3.0"
    And "packages/mypkg/package.json" contains version "1.3.0"

  Scenario: the package.json keeps its other fields and its own indentation
    Given ".agents/universal-plugin.json" declares packagePath "packages/mypkg"
    And "packages/mypkg/package.json" has a "name" and a "scripts" field, indented with two spaces
    When I run "universal-plugin plugin version patch --root <root>"
    Then "packages/mypkg/package.json" still contains its "name" and "scripts" fields
    And "packages/mypkg/package.json" is still indented with two spaces

  Scenario: without a declared packagePath only the manifest is written
    Given the manifest version is "1.2.3"
    And no ".agents/universal-plugin.json" exists
    When I run "universal-plugin plugin version patch --root <root>"
    Then the exit code is 0
    And "plugin.json" contains version "1.2.4"
    And no "package.json" is written at the project root

  Scenario: both authored files are reported as updated
    Given ".agents/universal-plugin.json" declares packagePath "packages/mypkg"
    And "packages/mypkg/package.json" exists at version "1.2.3"
    When I run "universal-plugin plugin version patch --root <root>"
    Then the result reports "plugin.json" as updated
    And the result reports "packages/mypkg/package.json" as updated

  # ── Re-derive the vendor manifests ──

  Scenario: the derived vendor manifest carries the new version
    Given the manifest version is "1.2.3"
    And the manifest declares a harness for "claude-code"
    When I run "universal-plugin plugin version patch --root <root>"
    Then ".claude-plugin/plugin.json" contains version "1.2.4"

  Scenario: --no-build leaves the derived manifests untouched
    Given the manifest version is "1.2.3"
    And the manifest declares a harness for "claude-code"
    And ".claude-plugin/plugin.json" exists at version "1.2.3"
    When I run "universal-plugin plugin version patch --no-build --root <root>"
    Then "plugin.json" contains version "1.2.4"
    And ".claude-plugin/plugin.json" still contains version "1.2.3"

  Scenario: a plugin with no declared harnesses still bumps
    Given the manifest version is "1.2.3"
    And the manifest declares no harnesses
    When I run "universal-plugin plugin version patch --root <root>"
    Then the exit code is 0
    And "plugin.json" contains version "1.2.4"

  # ── Guards ──

  Scenario: a missing canonical manifest fails loud
    Given a project root with no "plugin.json"
    When I run "universal-plugin plugin version patch --root <root>"
    Then the exit code is 1
    And stderr contains "plugin.json"

  Scenario: a release type with no current version points at an explicit version
    Given the manifest has no "version" field
    When I run "universal-plugin plugin version patch --root <root>"
    Then the exit code is 1
    And stderr contains "no version"
    And stderr contains "explicit version"

  Scenario: an unrecognized bump argument names the accepted values
    Given the manifest version is "1.2.3"
    When I run "universal-plugin plugin version frobnicate --root <root>"
    Then the exit code is 1
    And stderr contains "frobnicate"
    And stderr contains "major"

  Scenario: a version that does not advance is refused
    Given the manifest version is "1.2.3"
    When I run "universal-plugin plugin version 1.0.0 --root <root>"
    Then the exit code is 1
    And stderr contains "1.2.3"
    And stderr contains "--force"

  Scenario: --force allows a version that does not advance
    Given the manifest version is "1.2.3"
    When I run "universal-plugin plugin version 1.0.0 --force --root <root>"
    Then the exit code is 0
    And "plugin.json" contains version "1.0.0"

  Scenario: a declared packagePath with no package.json fails before any write
    Given the manifest version is "1.2.3"
    And ".agents/universal-plugin.json" declares packagePath "packages/missing"
    When I run "universal-plugin plugin version patch --root <root>"
    Then the exit code is 1
    And stderr contains "packages/missing"
    And "plugin.json" still contains version "1.2.3"

  Scenario: a failing guard leaves every file untouched
    Given the manifest version is "1.2.3"
    And the manifest declares a harness for "claude-code"
    When I run "universal-plugin plugin version frobnicate --root <root>"
    Then the exit code is 1
    And "plugin.json" still contains version "1.2.3"
    And ".claude-plugin/plugin.json" is NOT written

  Scenario: --dry-run reports the plan and writes nothing
    Given the manifest version is "1.2.3"
    When I run "universal-plugin plugin version patch --dry-run --root <root>"
    Then the exit code is 0
    And the result reports the target version "1.2.4"
    And "plugin.json" still contains version "1.2.3"

  Scenario: an unknown flag fails loud
    Given the manifest version is "1.2.3"
    When I run "universal-plugin plugin version patch --frobnicate --root <root>"
    Then the exit code is 1
    And stderr names the unknown flag

  # ── AXI output contract ──

  Scenario: a successful run prints a row per written file plus the updated aggregate
    Given the manifest version is "1.2.3"
    When I run "universal-plugin plugin version patch --root <root>"
    Then stdout contains a row for "plugin.json"
    And stdout contains the updated count

  Scenario: --format json returns the from, to, and written fields
    Given the manifest version is "1.2.3"
    When I run "universal-plugin plugin version patch --format json --root <root>"
    Then stdout is valid JSON
    And that JSON has "from" of "1.2.3"
    And that JSON has "to" of "1.2.4"
    And that JSON has a "written" array containing "plugin.json"

  Scenario: a successful run ends with a next-step line
    Given the manifest version is "1.2.3"
    When I run "universal-plugin plugin version patch --root <root>"
    Then stderr contains a next-step line

  # ── Print the command reference ──

  Scenario: --help prints a concise reference
    When I run "universal-plugin plugin version --help"
    Then the exit code is 0
    And stdout contains "--preid"
    And stdout contains "--no-build"
    And stdout contains "--dry-run"
