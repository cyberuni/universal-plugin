Feature: marketplace update — change one listed entry in place

  Background:
    Given a repository whose root plugin.json names an author

  Scenario: a request that changes nothing fails
    Given "repobuddy" is listed in the Claude catalog
    When I run "universal-plugin marketplace update repobuddy --root <root>"
    Then the command fails saying there is nothing to change
    And the exit code is 1

  Scenario: name and source cannot be unset
    Given "repobuddy" is listed in the Claude catalog
    When I run "universal-plugin marketplace update repobuddy --unset source --root <root>"
    Then the command fails saying every entry needs a source
    And no catalog changes

  Scenario: a field both set and unset fails
    Given "repobuddy" is listed in the Claude catalog
    When I run "universal-plugin marketplace update repobuddy --description New --unset description --root <root>"
    Then the command fails naming "description" as both set and unset

  Scenario: a marketplace spec is not a source
    Given "repobuddy" is listed in the Claude catalog
    When I run "universal-plugin marketplace update repobuddy --source repobuddy@cyberplace --root <root>"
    Then the command fails pointing at marketplace add

  Scenario: an entry no catalog lists points at add
    Given no catalog lists "ghost"
    When I run "universal-plugin marketplace update ghost --description x --root <root>"
    Then the command fails pointing at marketplace add
    And the exit code is 1

  Scenario: a new source keeps every other field
    Given "repobuddy" is listed with source github "cyberuni/repobuddy", a description, a category, and an author
    When I run "universal-plugin marketplace update repobuddy --source https://github.com/cyberuni/repobuddy.git --root <root>"
    Then each catalog listing "repobuddy" states a url source naming that URL
    And the Claude entry keeps its description, category, and author

  Scenario: a new git source keeps the old pin
    Given "repobuddy" is listed with source github "cyberuni/repobuddy" pinned to ref "v1.0.0" and a sha
    When I run "universal-plugin marketplace update repobuddy --source https://github.com/cyberuni/repobuddy.git --root <root>"
    Then the new source carries ref "v1.0.0" and the same sha

  Scenario: a ref moves and the stale sha goes
    Given "aced" is listed with a git-subdir source pinned to ref "v1.0.0" and a sha
    When I run "universal-plugin marketplace update aced --ref v1.1.0 --unset sha --root <root>"
    Then each catalog's source for "aced" carries ref "v1.1.0" and no sha
    And the Copilot entry is still a github source with path "plugins/aced"

  Scenario: a pin on an entry with no git source fails
    Given "repobuddy" is listed with an npm source
    When I run "universal-plugin marketplace update repobuddy --ref main --root <root>"
    Then the command fails naming the catalog and saying --ref and --sha apply to a git source

  Scenario: one field changes and the rest stay
    Given the Claude catalog lists "alpha" and "repobuddy", and "repobuddy" carries a license and a category
    When I run "universal-plugin marketplace update repobuddy --description New --root <root>"
    Then the "repobuddy" entry carries description "New" with its license and category in their old order
    And "alpha" and the catalog top level are unchanged

  Scenario: a Codex entry takes only the fields its catalog carries
    Given "repobuddy" is listed in the Claude and Codex catalogs
    When I run "universal-plugin marketplace update repobuddy --description New --category tools --root <root>"
    Then the Claude entry carries both
    And the Codex entry carries the category and no description

  Scenario: a catalog that does not list the entry is skipped
    Given "repobuddy" is listed in the Claude catalog and the Copilot catalog does not list it
    When I run "universal-plugin marketplace update repobuddy --description New --root <root>"
    Then the Copilot target is reported skipped saying the entry is not listed there

  Scenario: a runtime that cannot install the new source keeps the old entry
    Given "repobuddy" is listed with a github source in all four catalogs
    When I run "universal-plugin marketplace update repobuddy --source npm:repobuddy --root <root>"
    Then the Claude and Codex targets are reported updated
    And the Copilot and Cursor targets are reported skipped, and their entries keep the github source

  Scenario: a runtime reading the Claude catalog is shielded
    Given "repobuddy" is listed with a github source in the Claude catalog only
    When I run "universal-plugin marketplace update repobuddy --source npm:repobuddy --root <root>"
    Then a Copilot catalog is written without "repobuddy"
    And no Codex catalog is written, because Codex installs npm

  Scenario: an equivalent update is unchanged
    Given "repobuddy" is listed with description "Same"
    When I run "universal-plugin marketplace update repobuddy --description Same --root <root>"
    Then every target listing it is reported unchanged

  Scenario: an update that would break a catalog writes nothing
    Given "repobuddy" is listed in the Claude catalog
    When I run "universal-plugin marketplace update repobuddy --source ./vendor/missing --root <root>"
    Then the command fails saying the source points at a directory that does not exist
    And no catalog changes

  Scenario: an issue the catalog already had does not block the update
    Given the Claude catalog also lists an entry whose "./" source does not exist
    When I run "universal-plugin marketplace update repobuddy --description New --claude --root <root>"
    Then the Claude target is reported updated

  Scenario: dry run reports the plan without writing it
    Given "repobuddy" is listed in the Claude catalog
    When I run "universal-plugin marketplace update repobuddy --description New --claude --dry-run --root <root>"
    Then the Claude target is reported planned
    And no catalog changes
    And stderr says metadata was planned rather than written

  Scenario: default output is TOON and states the local-only boundary
    Given "repobuddy" is listed in the Claude catalog
    When I run "universal-plugin marketplace update repobuddy --description New --root <root>"
    Then stdout is a TOON table of target, status, entry, source, and path
    And stderr says no marketplace publication or registration occurred

  Scenario: JSON output exposes the result rows
    Given "repobuddy" is listed in the Claude catalog
    When I run "universal-plugin marketplace update repobuddy --description New --format json --root <root>"
    Then stdout is a JSON array of rows carrying target status entry source and path
