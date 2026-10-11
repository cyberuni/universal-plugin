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

  Scenario: the canonical manifest keeps the lines the bump does not change
    Given the manifest version is "1.2.3"
    And "plugin.json" is tab-indented with a "keywords" array on one line and a trailing newline
    When I run "universal-plugin plugin version patch --root <root>"
    Then "plugin.json" differs from before only in its "version" line

  Scenario: a manifest with no indentation to read takes the .editorconfig indentation
    Given the manifest version is "1.2.3"
    And "plugin.json" is written on a single line
    And an ".editorconfig" at the root sets "indent_style = space" and "indent_size = 4" for "*.json"
    When I run "universal-plugin plugin version patch --root <root>"
    Then "plugin.json" is indented with four spaces

  # ── Pick the version source ──

  Scenario: --from-package stamps the version the package already carries
    Given the manifest version is "1.2.3"
    And ".agents/universal-plugin.json" declares packagePath "packages/mypkg"
    And "packages/mypkg/package.json" exists at version "1.3.0"
    When I run "universal-plugin plugin version --from-package --root <root>"
    Then the exit code is 0
    And "plugin.json" contains version "1.3.0"

  Scenario: --from-package leaves the package.json untouched
    Given ".agents/universal-plugin.json" declares packagePath "packages/mypkg"
    And "packages/mypkg/package.json" exists at version "1.3.0"
    When I run "universal-plugin plugin version --from-package --root <root>"
    Then "packages/mypkg/package.json" is unchanged
    And the result does not report "packages/mypkg/package.json"

  Scenario: --from-package re-stamps the version the manifest already carries
    Given the manifest version is "1.3.0"
    And ".agents/universal-plugin.json" declares packagePath "packages/mypkg"
    And "packages/mypkg/package.json" exists at version "1.3.0"
    When I run "universal-plugin plugin version --from-package --root <root>"
    Then the exit code is 0

  Scenario: --from-package reads the plugin root package.json when no packagePath is declared
    Given no ".agents/universal-plugin.json" exists
    And "package.json" at the plugin root exists at version "2.0.0"
    When I run "universal-plugin plugin version --from-package --root <root>"
    Then "plugin.json" contains version "2.0.0"

  Scenario: --from-package names where it looked when there is no package
    Given no ".agents/universal-plugin.json" exists
    And the plugin root has no "package.json"
    When I run "universal-plugin plugin version --from-package --root <root>"
    Then the exit code is 1
    And stderr contains "packagePath is not set"
    And stderr contains "no package.json"

  Scenario: --from-package refuses a package without a version
    Given "package.json" at the plugin root has no "version"
    When I run "universal-plugin plugin version --from-package --root <root>"
    Then the exit code is 1
    And stderr contains "No version found in package.json"

  Scenario: --from-package refuses the semantic-release placeholder
    Given "package.json" at the plugin root exists at version "0.0.0-development"
    When I run "universal-plugin plugin version --from-package --root <root>"
    Then the exit code is 1
    And stderr contains "0.0.0-development"

  Scenario: a version and --from-package together are refused
    When I run "universal-plugin plugin version 1.4.0 --from-package --root <root>"
    Then the exit code is 1
    And stderr contains "not both"

  Scenario: neither a version nor --from-package is refused
    When I run "universal-plugin plugin version --root <root>"
    Then the exit code is 1
    And stderr contains "--from-package"

  Scenario: a release type is refused where packagePath is declared
    Given the manifest version is "1.2.3"
    And ".agents/universal-plugin.json" declares packagePath "packages/mypkg"
    And "packages/mypkg/package.json" exists at version "1.2.3"
    When I run "universal-plugin plugin version minor --root <root>"
    Then the exit code is 1
    And stderr contains "packages/mypkg/package.json"
    And stderr contains "--from-package"
    And "plugin.json" still contains version "1.2.3"

  Scenario: an explicit version is still taken where packagePath is declared
    Given the manifest version is "1.2.3"
    And ".agents/universal-plugin.json" declares packagePath "packages/mypkg"
    And "packages/mypkg/package.json" exists at version "1.2.3"
    When I run "universal-plugin plugin version 1.4.0 --root <root>"
    Then "plugin.json" contains version "1.4.0"
    And "packages/mypkg/package.json" contains version "1.4.0"

  Scenario: an explicit version replaces an unstamped manifest without --force
    Given the manifest version is "0.0.0-development"
    When I run "universal-plugin plugin version 1.0.0 --root <root>"
    Then the exit code is 0
    And "plugin.json" contains version "1.0.0"

  # ── Stamp the places that restate the version ──

  Scenario: skill pins are stamped in Markdown and in scripts
    Given the plugin's package "my-cli" is at version "1.3.0"
    And "skills/use/SKILL.md" contains "npx -y my-cli@1.2.3 go"
    And "skills/use/scripts/run.mjs" contains "npx my-cli@1.2.3"
    When I run "universal-plugin plugin version --from-package --root <root>"
    Then "skills/use/SKILL.md" contains "npx -y my-cli@1.3.0 go"
    And "skills/use/scripts/run.mjs" contains "npx my-cli@1.3.0"

  Scenario: skill pins are stamped in json, yaml and txt files
    Given the plugin's package "my-cli" is at version "1.3.0"
    And a "json", a "yaml" and a "txt" file under "skills/use" each pin "upx my-cli@1.2.3"
    When I run "universal-plugin plugin version --from-package --root <root>"
    Then each of those files pins "my-cli@1.3.0"

  Scenario: a workspace CLI pins to its workspace version and an external package is untouched
    Given the plugin's package "my-cli" is at version "1.3.0"
    And a workspace member "other-cli" is at version "4.5.6"
    And a skill pins "my-cli@1.2.3", "other-cli@0.0.1" and "left-pad@1.0.0"
    When I run "universal-plugin plugin version --from-package --root <root>"
    Then the skill pins "my-cli@1.3.0", "other-cli@4.5.6" and "left-pad@1.0.0"

  Scenario: a pin-exempt skill is excluded entirely
    Given a skill with frontmatter "metadata.pin-exempt: true" pins "my-cli@1.2.3"
    When I run "universal-plugin plugin version --from-package --root <root>"
    Then that skill's files are unchanged
    And ".plugin/pins.json" has no entry from that skill

  Scenario: .plugin/pins.json maps the pins, key-sorted
    Given the plugin's package "my-cli" is at version "1.3.0"
    And a workspace member "other-cli" is at version "4.5.6"
    And skills pin both
    When I run "universal-plugin plugin version --from-package --root <root>"
    Then ".plugin/pins.json" is a map with keys "my-cli" and "other-cli" in that order
    And it holds "1.3.0" and "4.5.6"

  Scenario: no pins map is written when there is nothing to map
    Given no skill pins a package the plugin versions
    And no ".plugin/pins.json" exists
    When I run "universal-plugin plugin version --from-package --root <root>"
    Then no ".plugin/pins.json" is written

  Scenario: an existing pins map is kept current
    Given ".plugin/pins.json" exists
    And no skill pins a package the plugin versions
    When I run "universal-plugin plugin version --from-package --root <root>"
    Then ".plugin/pins.json" is rewritten as an empty map

  Scenario: the pins map takes the repository's JSON format
    Given an ".editorconfig" at the root sets "indent_style = space" and "indent_size = 2" for "*.json"
    And a skill pins the plugin's package
    When I run "universal-plugin plugin version --from-package --root <root>"
    Then ".plugin/pins.json" is indented with two spaces and ends in a newline

  Scenario: a compiled script's embedded version is stamped and nothing else in it
    Given "skills/a/scripts/a.mjs" is a compiled skill script embedding version "1.2.3"
    And its compiled code carries "npx my-cli@1.2.3"
    When I run "universal-plugin plugin version 1.3.0 --root <root>"
    Then the script's header embeds version "1.3.0"
    And the rest of the script, "npx my-cli@1.2.3" included, is unchanged
    And "universal-plugin plugin build --dry-run" reports the script "unchanged"

  Scenario: a marked inline mcpServers entry is stamped and keeps its marker
    Given "plugin.json" carries an inline mcpServers entry running "npx -y my-cli@1.2.3 mcp" marked "pinToPluginVersion"
    When I run "universal-plugin plugin version --from-package --root <root>"
    Then that entry in "plugin.json" runs "npx -y my-cli@1.3.0 mcp"
    And it still carries "pinToPluginVersion"

  Scenario: a marked entry in an authored mcp file is stamped and keeps its marker
    Given "plugin.json" declares mcpServers "./mcp.json"
    And "mcp.json" has an entry running "npx -y my-cli@1.2.3 mcp" marked "pinToPluginVersion"
    When I run "universal-plugin plugin version --from-package --root <root>"
    Then that entry in "mcp.json" runs "npx -y my-cli@1.3.0 mcp"
    And it still carries "pinToPluginVersion"

  Scenario: an mcp file with nothing to move is left unwritten
    Given "mcp.json" has no entry marked "pinToPluginVersion"
    When I run "universal-plugin plugin version --from-package --root <root>"
    Then "mcp.json" is unchanged

  Scenario: a marked entry that cannot be stamped warns and does not fail
    Given a marked mcpServers entry whose command is "node"
    When I run "universal-plugin plugin version --from-package --root <root>"
    Then the exit code is 0
    And stderr contains a warning naming that entry

  Scenario: --dry-run plans every stamped place and writes none
    Given skills, an mcp file and the pins map would all change
    When I run "universal-plugin plugin version --from-package --dry-run --root <root>"
    Then the exit code is 0
    And the result lists "plugin.json", the skill file, "mcp.json" and ".plugin/pins.json" as planned
    And none of those files is written

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

  Scenario: rows say updated, stamped or derived and the summary counts each
    Given a skill pin, a marked mcp entry and a declared "claude-code" harness
    When I run "universal-plugin plugin version --from-package --root <root>"
    Then "plugin.json" is reported as updated
    And the skill file and "mcp.json" are reported as stamped
    And ".claude-plugin/plugin.json" is reported as derived
    And the summary counts each action

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
    And stderr contains "→ review and commit the stamped files"

  Scenario: --no-build points at plugin build
    Given the manifest version is "1.2.3"
    When I run "universal-plugin plugin version patch --no-build --root <root>"
    Then stderr ends with "→ universal-plugin plugin build"

  # ── Check that every file agrees ──

  Scenario: check-version passes when every file carries the same version
    Given "packagePath" names a package at "0.9.0"
    And the manifest, a derived vendor manifest, the catalog entry and a skill pin all carry "0.9.0"
    When I run "universal-plugin publish check-version --root <root>"
    Then the exit code is 0
    And nothing is written

  Scenario: check-version names every file a release left behind
    Given "packagePath" names a package at "0.9.0"
    And the manifest, a derived vendor manifest, the catalog entry and a skill pin all carry "0.8.0"
    When I run "universal-plugin publish check-version --root <root>"
    Then the exit code is 1
    And stdout names "plugin.json", the vendor manifest, the catalog and the skill file
    And stderr ends with "→ universal-plugin plugin version --from-package"

  Scenario: without packagePath the canonical manifest is the reference
    Given no "packagePath" is declared
    And the manifest version is "1.0.0"
    And ".claude-plugin/plugin.json" carries "0.9.0"
    When I run "universal-plugin publish check-version --root <root>"
    Then the exit code is 1
    And stderr contains ".claude-plugin/plugin.json is 0.9.0, plugin.json is 1.0.0"

  Scenario: a skill pin left behind points at plugin version
    Given "packagePath" names a package at "0.9.0"
    And every file but one skill pin carries "0.9.0"
    When I run "universal-plugin publish check-version --root <root>"
    Then the exit code is 1
    And stderr ends with "→ universal-plugin plugin version --from-package"

  Scenario: a pin that is not a version is not compared
    Given "packagePath" names a package at "0.9.0"
    And a skill pins the package at "<version>" and at "latest"
    When I run "universal-plugin publish check-version --root <root>"
    Then the skill file is not reported

  Scenario: a marked mcpServers entry left behind is drift
    Given "packagePath" names a package at "0.9.0"
    And a marked mcpServers entry pins the package at "0.8.0"
    When I run "universal-plugin publish check-version --root <root>"
    Then the exit code is 1
    And stdout names the file holding that entry

  Scenario: a place at 0.0.0-development is unstamped, not drifted
    Given "packagePath" names a package at "0.0.0-development"
    And the manifest version is "1.2.3"
    When I run "universal-plugin publish check-version --root <root>"
    Then the exit code is 0
    And stderr contains "package.json is unstamped (0.0.0-development) — the release stamps it"
    And the summary reads "checked" with "drifted 0" and "unstamped 1"

  Scenario: nothing drifts when no file holds a real version
    Given the package and the manifest both carry "0.0.0-development"
    When I run "universal-plugin publish check-version --root <root>"
    Then the exit code is 0
    And no file is reported as drifted

  Scenario: a vendor manifest left behind points at plugin build
    Given no "packagePath" is declared
    And the manifest version is "1.0.0"
    And only ".claude-plugin/plugin.json" carries "0.9.0"
    When I run "universal-plugin publish check-version --root <root>"
    Then the exit code is 1
    And stderr ends with "→ universal-plugin plugin build"

  Scenario: a package and manifest that disagree point at the version skill
    Given "packagePath" names a package at "0.9.0"
    And the manifest version is "0.8.0"
    When I run "universal-plugin publish check-version --root <root>"
    Then the exit code is 1
    And stderr ends with "/universal-plugin:version"

  Scenario: a compiled script behind on its version is drift, reported once
    Given "packagePath" names a package at "0.9.0"
    And a compiled skill script embeds version "0.8.0" and its inlined code pins the package at "0.7.0"
    When I run "universal-plugin publish check-version --root <root>"
    Then the exit code is 1
    And the script is reported once, with version "0.8.0" and kind "compiled-script"

  Scenario: check-version fails loud without a canonical manifest
    Given an empty root
    When I run "universal-plugin publish check-version --root <root>"
    Then the exit code is 1
    And stderr contains "No plugin.json found"

  # ── Deprecated aliases ──

  Scenario: publish sync-version warns and runs the --from-package stamp
    Given the plugin's package "my-cli" is at version "1.3.0"
    And a skill pins "my-cli@1.2.3"
    When I run "universal-plugin publish sync-version --root <root>"
    Then the exit code is 0
    And stderr contains "publish sync-version is deprecated and will be removed in the next minor release — use plugin version --from-package"
    And "plugin.json" contains version "1.3.0"
    And the skill pins "my-cli@1.3.0"

  # ── Print the command reference ──

  Scenario: --help prints a concise reference
    When I run "universal-plugin plugin version --help"
    Then the exit code is 0
    And stdout contains "--preid"
    And stdout contains "--no-build"
    And stdout contains "--dry-run"
    And stdout contains "--from-package"
