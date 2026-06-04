# uni-plugin specs

Behavioral specifications for the `uni-plugin` CLI. Each domain has its own subfolder with a narrative spec (`spec.md`) and Gherkin scenarios (`.feature`).

## What

`uni-plugin` is the CLI for universal AI agent plugin authoring, distribution, and consumption. It provides a single tool that works across all major AI agent runtimes (Claude Code, Cursor, Codex, Copilot CLI).

## Command surface

| Command | Domain | Status |
|---|---|---|
| `uni-plugin build [--vendor <id>]` | [build](./build/spec.md) | Implemented |
| `uni-plugin governance show <name>` | [governance](./governance/spec.md) | Implemented |
| `uni-plugin governance list` | [governance](./governance/spec.md) | Implemented |
| `uni-plugin validate` | validate | Planned |
| `uni-plugin init` | init | Planned |
| `uni-plugin prepare` | prepare | Planned |
| `uni-plugin add <plugin>` | plugin | Planned |
| `uni-plugin remove <plugin>` | plugin | Planned |
| `uni-plugin update [plugin]` | plugin | Planned |
| `uni-plugin find <query>` | plugin | Planned |
| `uni-plugin search <query>` | plugin | Planned |
| `uni-plugin list` | plugin | Planned |
| `uni-plugin migrate` | plugin | Planned |
| `uni-plugin hook register` | hook | Planned |
| `uni-plugin marketplace publish` | marketplace | Planned |
| `uni-plugin marketplace register` | marketplace | Planned |

## Domain index

- [build](./build/spec.md) — compile canonical plugin manifest into vendor-specific output files
- [governance](./governance/spec.md) — resolve and display governance documents by name across scopes
