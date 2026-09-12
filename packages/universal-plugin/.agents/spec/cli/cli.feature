@frozen
Feature: cli — the root program's own identity

  # ── --version / -V ──

  Scenario: --version reports the installed package's version, not a placeholder
    Given the installed "universal-plugin" package.json declares version "<pkg-version>"
    When I run "universal-plugin --version"
    Then the exit code is 0
    And stdout is exactly "<pkg-version>"

  Scenario: -V is the same as --version
    Given the installed "universal-plugin" package.json declares version "<pkg-version>"
    When I run "universal-plugin -V"
    Then the exit code is 0
    And stdout is exactly "<pkg-version>"

  Scenario: --version is independent of the working directory and any target plugin.json
    Given an empty directory with no "plugin.json"
    And the installed "universal-plugin" package.json declares version "<pkg-version>"
    When I run "universal-plugin --version" from that empty directory
    Then stdout is exactly "<pkg-version>"

  Scenario: --version never reports a hardcoded placeholder
    Given the installed "universal-plugin" package.json declares a version other than "0.0.0"
    When I run "universal-plugin --version"
    Then stdout is not "0.0.0"
