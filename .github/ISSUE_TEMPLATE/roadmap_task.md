---
name: Roadmap task
about: Track one activity of the ROADMAP.md DAG (one issue per activity ID)
title: '[X-00] '
labels: dag
assignees: ''
---

<!-- One issue per roadmap activity. Use the activity ID from ROADMAP.md in the title,
     e.g. "[P-05] Tokenizador e empacotamento". Do not invent IDs: add the activity to
     the roadmap table first (and run `python3 scripts/roadmap.py render`). -->

## Activity

- **ID:**
- **Milestone:**
- **Depends on:** <!-- every dependency must be `feito` before work starts -->

## Deliverable

<!-- Copy the "Entregável" cell from ROADMAP.md. -->

## Acceptance criterion

<!-- Copy the "Critério de aceite" cell from ROADMAP.md. If it is not verifiable as written,
     fix the roadmap first. -->

## Plan

<!-- How you intend to split the work into small pull requests. -->

- [ ]
- [ ]

## Ready to start?

- [ ] All dependencies are `feito` in ROADMAP.md.
- [ ] The acceptance criterion is verifiable as written.
- [ ] Any required RFC is accepted / any required ADR is drafted (see docs/METHODOLOGY.md).
- [ ] The activity is sized `L` or smaller (split `XL` first).

## Done when

- [ ] Acceptance criterion demonstrated (test or versioned raw data).
- [ ] Global Definition of Done met (ROADMAP.md, section 12).
- [ ] Activity state updated in ROADMAP.md and `python3 scripts/roadmap.py render` executed.
