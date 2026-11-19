# Changelog

All notable changes to **som-webcore** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

- Versions are tagged as `v<MAJOR>.<MINOR>.<PATCH>` from `main`.
- Entries are generated from [Conventional Commits](https://www.conventionalcommits.org/)
  at release time (see `cliff.toml` and the release automation in `.github/workflows/`).
- Compare views: <https://github.com/frederico-kluser/som-webcore/compare/>

## [Unreleased]

### Added

- **Memória CoALA local** (`.agents/som-webcore-coala-agent-skill/`) com o catálogo dos dois
  relatórios de pesquisa, notas de arquitetura, riscos, modelos, benchmarks e roadmap.
- **README/whitepaper autossuficiente** (`README.md`) com manifesto, arquitetura, especificação
  técnica, catálogo de modelos, números, blueprint de implementação, riscos, roadmap, FAQ,
  glossário e bibliografia completa dos dois relatórios.
- **Cinco figuras-infográfico** em `docs/figures/` e banner em `docs/assets/banner.svg`.
- **Fundação open-source**: `LICENSE` Apache-2.0, `NOTICE`, `CONTRIBUTING.md`, `SECURITY.md`,
  `CODE_OF_CONDUCT.md`, `CODEOWNERS`, templates de issue/PR e `CHANGELOG.md`.
- **Governança como código**: rulesets de branch, tags imutáveis, nomes de branch e commits
  convencionais; hooks locais `pre-push` + `commit-msg`.
- **CI de documentação** (`scripts/check-docs.py`) que valida links, âncoras, tabelas, figuras,
  placeholders e o contrato mínimo do README.

### Changed

- O escopo desta primeira entrega é **memória + documentação**; o runtime Rust/Wasm32 e os
  shaders WGSL ainda não foram implementados.
- A política de revisão foi adaptada para **mantenedor único**: PR obrigatório, `build` verde e
  squash merge, sem exigir aprovações externas enquanto não houver uma segunda pessoa.

### Fixed

- Nenhuma correção de código nesta versão; o projeto ainda não tem runtime.

<!--
  [Unreleased]: https://github.com/frederico-kluser/som-webcore/compare/v0.1.0...HEAD
-->
