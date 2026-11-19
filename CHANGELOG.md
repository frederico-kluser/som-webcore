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
- **Auditoria de arquitetura aplicada ao README:** embeddings passam a viver na Seção A/OPFS
  (o slab estático não contém `tok_embeddings`), a submissão é explicitamente **3 chunks**,
  Q4_K é formato de origem (o runtime executa Q8_0/Q4_0), o `S_max` normativo é **1.024**, o
  `DecisionPacket`/ring tem capacidade de **1.056 B**, e as unidades das tabelas são **MiB**.
- **Fatos do d1-omni reconciliados com o `config.json` oficial:** 16 camadas (10 conv + 6
  full attention), temperaturas por bucket (`choice:11+ = 1.3725`), `projector_hidden_size=2048`.
- **Bibliografia:** 41 URLs quebradas por quebra de linha foram corrigidas; entradas sem URL
  foram marcadas como “fonte não identificada no relatório”, sem inventar links.
- Adicionados apêndices de **quantização** (Q8_0/Q4_0/Q4_K), **classes de dispositivo**,
  **Tabela 3 — de onde copiar kernels** e **cooperative matrix** (SPIR-V/MSL).
- **Release Please desativado** nesta fase (`gh workflow disable`): não há runtime/pacote e o
  GitHub Actions não pode criar PRs; o motivo e o procedimento de reativação estão no cabeçalho
  do workflow.
- **`.gitattributes`** marca a memória CoALA como vendorizada e os textos de pesquisa/figuras
  como documentação, para que a estatística de linguagens do GitHub reflita o estado real
  (repositório de documentação, não projeto Python).

### Fixed

- Nenhuma correção de código nesta versão; o projeto ainda não tem runtime.

<!--
  [Unreleased]: https://github.com/frederico-kluser/som-webcore/compare/v0.1.0...HEAD
-->
