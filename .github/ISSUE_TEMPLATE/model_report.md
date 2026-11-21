---
name: Model compatibility report
about: Propose a decision model for the catalog, or report how a checkpoint behaves
title: '[model] '
labels: model, triage
assignees: ''
---

<!-- The repository does not distribute weights. A catalog entry points to a pinned revision
     of the original repository and declares its licence. The default selector only admits
     permissive licences. -->

## Checkpoint

- **Repository and pinned revision:**
- **Licence (SPDX) and link to the licence text:**
- **Commercial use allowed?**
- **Languages:**
- **Parameters:**

## Architecture (from `config.json`, not from prose)

- **Backbone family:** <!-- ModernBERT/Ettin, mmBERT, LFM2, other -->
- **Layers / hidden size / intermediate size / heads:**
- **Attention pattern:** <!-- global every N layers, local window, GQA… -->
- **RoPE theta (global / local):**
- **Vocabulary size and special tokens:**

## Decision head

- **Sequence layout:** <!-- e.g. [CLS] instructions [SEP] state [SEP] [OPT] option… -->
- **Scoring head:**
- **Calibration:** <!-- temperature tables, Platt, dynamic temperature… and whether it is actually calibrated -->
- **Option isolation / position reset?**
- **Reference implementation:** <!-- file in the model repository -->

## Quality and size

- **Quality metric, source and date:** <!-- who reported it: author or independent board -->
- **Download size per variant:**

## Parity (if you ran it)

<!-- Largest absolute probability difference against the reference implementation, corpus used. -->

- [ ] I read the model card and the licence myself.
- [ ] Architecture values were taken from the published `config.json`.
