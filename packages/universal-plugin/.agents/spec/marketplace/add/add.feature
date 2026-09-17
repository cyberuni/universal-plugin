@frozen
Feature: marketplace add — list a plugin that lives elsewhere

  Background:
    Given a repository whose root plugin.json names an author

  Scenario: a path source reaches every runtime
    When I run "universal-plugin marketplace add ./vendor/beta --root <root>"
    Then every target is reported added
    And each catalog lists "beta" with source "./vendor/beta"

  Scenario: an npm source reaches the runtimes that install from npm
    When I run "universal-plugin marketplace add npm:repobuddy --root <root>"
    Then the Claude and Codex targets are reported added with an npm source
    And the Copilot and Cursor targets are reported skipped
    And each skip names the source kind and the runtime that cannot resolve it

  Scenario: a skipped target's catalog is not written
    When I run "universal-plugin marketplace add npm:repobuddy --root <root>"
    Then no Copilot catalog exists

  Scenario: a forge source reaches the runtime that resolves it
    When I run "universal-plugin marketplace add cyberuni/universal-plugin --root <root>"
    Then the Claude target is reported added with a github source naming that repository
    And the Codex, Copilot, and Cursor targets are reported skipped

  Scenario: a git URL is read as a url source
    When I run "universal-plugin marketplace add https://example.com/o/r.git --claude --root <root>"
    Then the entry carries a url source naming that URL
    And the entry is named "r"

  Scenario: a leading scope marker is not a marketplace separator
    When I run "universal-plugin marketplace add @cyberuni/upx --claude --root <root>"
    Then the entry carries an npm source for package "@cyberuni/upx"
    And the entry is named "upx"

  Scenario: an unannounced path reads as a forge slug
    When I run "universal-plugin marketplace add plugins/alpha --claude --root <root>"
    Then the entry carries a github source
    And running it again with "--path" carries a source of "./plugins/alpha"

  Scenario: an explicit kind overrides the guess
    When I run "universal-plugin marketplace add cyberuni/repobuddy --npm --claude --root <root>"
    Then the entry carries an npm source for package "cyberuni/repobuddy"

  Scenario: more than one source kind fails before writes
    When I run "universal-plugin marketplace add repobuddy --npm --github --root <root>"
    Then the command fails naming how many kinds were passed
    And the exit code is 1

  Scenario: an unrecognized spec names the flags that settle it
    When I run "universal-plugin marketplace add "not a spec" --root <root>"
    Then the error names --path, --npm, --github, --url, and --from-marketplace
    And the exit code is 1

  Scenario: an explicit entry name overrides the derived one
    When I run "universal-plugin marketplace add npm:repobuddy --name buddy --claude --root <root>"
    Then the entry is named "buddy"

  Scenario: an invalid entry name fails before writes
    Given a spec whose derived name violates the catalog name grammar
    When I run "universal-plugin marketplace add" with it
    Then the command fails before any catalog is written

  Scenario: a path source takes its metadata from the plugin manifest
    Given "./vendor/beta" contains a plugin.json with a description, version, and license
    When I run "universal-plugin marketplace add ./vendor/beta --claude --root <root>"
    Then the entry carries that description, version, and license

  Scenario: an installed package supplies its own metadata
    Given "node_modules/repobuddy" contains a package.json with a version
    When I run "universal-plugin marketplace add npm:repobuddy --claude --root <root>"
    Then the entry carries that version

  Scenario: a metadata flag overrides what was discovered
    Given "node_modules/repobuddy" contains a package.json with a description
    When I run "universal-plugin marketplace add npm:repobuddy --description "from the flag" --claude --root <root>"
    Then the entry carries the description from the flag

  Scenario: an unknown package is listed with what the flags supply
    Given no local copy of the package
    When I run "universal-plugin marketplace add npm:repobuddy --claude --root <root>"
    Then the entry carries a name and a source and no fetched metadata

  Scenario: an installed marketplace resolves without a network call
    Given marketplace "cyberplace" is installed in the runtime and lists "repobuddy" with an npm source
    When I run "universal-plugin marketplace add repobuddy@cyberplace --claude --root <root>"
    Then the entry carries the source and metadata that marketplace publishes

  Scenario: --from names a marketplace that is not installed
    Given a checkout of marketplace "cyberplace" that the runtime has not added
    When I run "universal-plugin marketplace add repobuddy@cyberplace --from <dir> --claude --root <root>"
    Then the entry carries the source that checkout publishes

  Scenario: an unresolvable marketplace fails before writes
    When I run "universal-plugin marketplace add ghost@nowhere --claude --root <root>"
    Then the error says the marketplace is not installed and names --from
    And the exit code is 1

  Scenario: a plugin the marketplace does not list fails before writes
    Given marketplace "cyberplace" is installed and does not list "ghost"
    When I run "universal-plugin marketplace add ghost@cyberplace --claude --root <root>"
    Then the error names the plugin and the marketplace
    And the exit code is 1

  Scenario: a local source in another marketplace is refused
    Given marketplace "cyberplace" lists "local-only" with a "./" source
    When I run "universal-plugin marketplace add local-only@cyberplace --claude --root <root>"
    Then the error says that source resolves only in that marketplace
    And the exit code is 1

  Scenario: a repository with no catalog gets one
    Given the repository carries no catalog
    When I run "universal-plugin marketplace add npm:repobuddy --claude --root <root>"
    Then a Claude catalog is created named and owned the way marketplace init names it

  Scenario: a missing marketplace owner fails before writes
    Given a repository with no root author
    When I run "universal-plugin marketplace add npm:repobuddy --claude --root <root>"
    Then the command fails saying an owner is required
    And no catalog is written

  Scenario: other entries and the catalog top level survive
    Given a Claude catalog listing "alpha" with a description of its own
    When I run "universal-plugin marketplace add npm:repobuddy --claude --root <root>"
    Then the catalog still lists "alpha" unchanged
    And the catalog keeps its name, owner, and key order

  Scenario: an equivalent rerun is unchanged
    Given "repobuddy" is already listed with exactly this entry
    When I run "universal-plugin marketplace add npm:repobuddy --claude --root <root>"
    Then the Claude target is reported unchanged

  Scenario: a differing entry fails without changing any catalog
    Given "repobuddy" is already listed with a different source
    When I run "universal-plugin marketplace add cyberuni/repobuddy --name repobuddy --claude --root <root>"
    Then the command fails naming the catalog and the --force remedy
    And the exit code is 1

  Scenario: force replaces the entry
    Given "repobuddy" is already listed with a different source
    When I run "universal-plugin marketplace add cyberuni/repobuddy --name repobuddy --claude --force --root <root>"
    Then the Claude target is reported updated
    And the entry carries the new source

  Scenario: dry run reports the plan without writing it
    When I run "universal-plugin marketplace add npm:repobuddy --claude --dry-run --root <root>"
    Then the Claude target is reported planned
    And no catalog is written
    And stderr says metadata was planned rather than written

  Scenario: an added entry survives a regeneration
    Given a repository whose plugins directory contains eligible plugin "alpha"
    And "repobuddy" has been added with an npm source
    When I run "universal-plugin marketplace init --claude --root <root>"
    Then the Claude target is reported unchanged
    And running it with "--force" still lists both "alpha" and "repobuddy"

  Scenario: default output is TOON and states the local-only boundary
    When I run "universal-plugin marketplace add npm:repobuddy --claude --root <root>"
    Then stdout is a TOON table of target, status, entry, source, and path
    And stderr says no marketplace publication or registration occurred

  Scenario: JSON output exposes the result rows
    When I run "universal-plugin marketplace add npm:repobuddy --claude --format json --root <root>"
    Then stdout is a JSON array of rows carrying target status entry source and path

  Scenario: an unsupported output format fails loud before writes
    When I run "universal-plugin marketplace add npm:repobuddy --format yaml --root <root>"
    Then the command fails naming the supported formats
    And the exit code is 1
