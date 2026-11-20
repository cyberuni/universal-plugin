Feature: marketplace set — edit a catalog's own fields in place

  Background:
    Given a repository whose four catalogs list "alpha" under marketplace "local" owned by "unional"

  Scenario: allowing a marketplace writes the Claude allowlist only
    When I run "universal-plugin marketplace set --allow-dependencies-on cyber-uni --root <root>"
    Then the Claude target is reported updated
    And the Claude catalog lists "cyber-uni" in allowCrossMarketplaceDependenciesOn, ahead of plugins
    And the Codex, Copilot, and Cursor targets are reported skipped and their catalogs do not change

  Scenario: allowing appends once and disallowing the last name drops the list
    Given the Claude catalog allows "a" and "b"
    When I run "universal-plugin marketplace set --allow-dependencies-on b --allow-dependencies-on c --root <root>"
    Then the allowlist is "a", "b", "c"
    When I run "universal-plugin marketplace set --disallow-dependencies-on a --disallow-dependencies-on b --disallow-dependencies-on c --root <root>"
    Then the Claude catalog carries no allowCrossMarketplaceDependenciesOn

  Scenario: the owner and description change in each catalog that carries them
    When I run "universal-plugin marketplace set --owner-email me@example.com --description Curated --root <root>"
    Then the Claude, Copilot, and Cursor catalogs carry owner name "unional", owner email "me@example.com", and description "Curated"
    And the Codex target is reported skipped

  Scenario: a field is unset, and an equivalent change is unchanged
    Given the owner carries email "me@example.com"
    When I run "universal-plugin marketplace set --unset owner.email --root <root>"
    Then the owner carries only its name
    When I run "universal-plugin marketplace set --owner unional --claude --root <root>"
    Then the Claude target is reported unchanged

  Scenario: a request that changes nothing or contradicts itself fails
    When I run "universal-plugin marketplace set --allow-dependencies-on x --disallow-dependencies-on x --root <root>"
    Then the command fails naming "x" as both allowed and disallowed
    And the exit code is 1

  Scenario: a change that would break a catalog writes nothing
    Given the Claude catalog has no owner
    When I run "universal-plugin marketplace set --owner-email me@example.com --claude --root <root>"
    Then the command fails saying owner.name is required
    And no catalog changes

  Scenario: a request no selected catalog carries fails
    When I run "universal-plugin marketplace set --description x --codex --root <root>"
    Then the command fails saying no selected catalog carries the fields

  Scenario: dry run reports the plan without writing it
    When I run "universal-plugin marketplace set --allow-dependencies-on x --dry-run --root <root>"
    Then the Claude target is reported planned
    And no catalog changes
