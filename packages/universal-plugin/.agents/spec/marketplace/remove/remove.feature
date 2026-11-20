Feature: marketplace remove — drop one listed entry from every catalog

  Background:
    Given a repository whose root plugin.json names an author

  Scenario: an entry is removed from every catalog and the rest stays
    Given "repobuddy" is listed in all four catalogs beside "alpha"
    And the Claude catalog carries a description and "alpha" carries a category
    When I run "universal-plugin marketplace remove repobuddy --root <root>"
    Then every target is reported removed
    And no catalog lists "repobuddy"
    And the Claude catalog keeps its description, and "alpha" keeps its category

  Scenario: a catalog that does not list the entry is skipped
    Given "repobuddy" is listed in the Claude catalog, the Codex catalog does not list it, and there is no Copilot catalog
    When I run "universal-plugin marketplace remove repobuddy --claude --codex --copilot --root <root>"
    Then the Claude target is reported removed
    And the Codex and Copilot targets are reported skipped with the reason

  Scenario: an entry no catalog lists fails
    Given no catalog lists "ghost"
    When I run "universal-plugin marketplace remove ghost --root <root>"
    Then the command fails saying "ghost" is not listed in any selected catalog
    And the exit code is 1

  Scenario: an entry another listed plugin depends on is kept
    Given the Claude catalog lists "base" and "dependent", and "dependent" depends on "base"
    When I run "universal-plugin marketplace remove base --root <root>"
    Then the command fails naming the dependency on "base" and pointing at --force
    And no catalog changes

  Scenario: force removes a depended-on entry and names what broke
    Given the Claude catalog lists "base" and "dependent", and "dependent" depends on "base"
    When I run "universal-plugin marketplace remove base --force --root <root>"
    Then the Claude target is reported removed
    And stderr warns that the dependency on "base" no longer resolves

  Scenario: removing a plugin still in the repository warns it will return
    Given "alpha" is listed with source "./plugins/alpha" and that directory holds a plugin.json
    When I run "universal-plugin marketplace remove alpha --root <root>"
    Then the entry is removed
    And stderr warns that plugin build and marketplace init will list it again

  Scenario: dry run reports the plan without writing it
    Given "alpha" is listed in the Claude catalog
    When I run "universal-plugin marketplace remove alpha --claude --dry-run --root <root>"
    Then the Claude target is reported planned
    And no catalog changes

  Scenario: JSON output exposes the result rows
    Given "repobuddy" is listed in the Claude catalog
    When I run "universal-plugin marketplace remove repobuddy --format json --root <root>"
    Then stdout is a JSON array of rows carrying target status entry source and path
    And stderr says no marketplace publication or registration occurred
