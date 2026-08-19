@frozen
Feature: marketplace validate — check the local catalogs against the schema each runtime loads

  Background:
    Given a repository whose plugins directory contains eligible plugin "alpha"

  Scenario: generated catalogs are valid in every runtime
    Given every vendor catalog has been generated
    When I run "universal-plugin marketplace validate --root <root>"
    Then every target is reported valid
    And the exit code is 0

  Scenario: an owner written as a string is reported with the object to write instead
    Given the generated Claude catalog is edited so owner is the string "Ari <ari@example.com>"
    When I run "universal-plugin marketplace validate --claude --root <root>"
    Then the Claude target is reported invalid
    And an issue names key "owner" and the object to write instead
    And the exit code is 1

  Scenario: a repository written as an npm object is reported with the string to write instead
    Given the generated Claude catalog is edited so the first entry repository is an object with type and url
    When I run "universal-plugin marketplace validate --claude --root <root>"
    Then an issue names key "plugins[0].repository" and the url string to write instead
    And the exit code is 1

  Scenario: an absent catalog is missing rather than invalid
    Given no Cursor catalog has been generated
    When I run "universal-plugin marketplace validate --cursor --root <root>"
    Then the Cursor target is reported missing with no issues
    And the exit code is 0

  Scenario: a required target with no catalog fails
    Given no Cursor catalog has been generated
    When I run "universal-plugin marketplace validate --cursor --required --root <root>"
    Then the Cursor target is reported invalid
    And the exit code is 1

  Scenario: a source that resolves nowhere is reported
    Given the Claude catalog has been generated
    And the plugin directory its entry names is removed
    When I run "universal-plugin marketplace validate --claude --root <root>"
    Then an issue names key "plugins[0].source" and the path that does not exist
    And the exit code is 1

  Scenario: the Codex catalog is judged by Codex rules
    Given the Codex catalog has been generated with a local object source and no owner
    When I run "universal-plugin marketplace validate --codex --root <root>"
    Then the Codex target is reported valid
    And the exit code is 0

  Scenario: a catalog that is not JSON is one issue, not a crash
    Given the Claude catalog contains text that is not JSON
    When I run "universal-plugin marketplace validate --claude --root <root>"
    Then the Claude target is reported invalid with one issue naming invalid JSON
    And the exit code is 1

  Scenario: json output carries the rows and the issues
    Given every vendor catalog has been generated
    When I run "universal-plugin marketplace validate --format json --root <root>"
    Then stdout is a JSON array of rows carrying target status path and issues
    And the exit code is 0
