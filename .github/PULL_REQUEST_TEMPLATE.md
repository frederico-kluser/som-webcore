<!-- Thank you for contributing to som-webcore!
     The PR title is used as the squash-merge commit message, so it MUST follow
     Conventional Commits (e.g. `feat: add exponential backoff to the HTTP client`). -->

## What

<!-- What does this change do? Keep it short and concrete. -->

## Why

<!-- Motivation and context. Which problem does it solve? Link related issues with
     closing keywords so they close automatically on merge: -->

Closes #

## How

<!-- Approach taken, alternatives considered, trade-offs. -->

## Roadmap

<!-- Which ROADMAP.md activity does this advance or complete? e.g. "Advances P-08" / "Completes P-05".
     Write "none" for fixes and maintenance that are not a roadmap activity. -->

Activity:

## Evidence

<!-- Whatever applies (see CONTRIBUTING.md, section 5):
     - numeric path touched → parity suite result;
     - performance claim → before/after report from the harness, same machine;
     - new number in the docs → evidence label and primary source with date. -->

## Checklist

- [ ] PR title follows [Conventional Commits](https://www.conventionalcommits.org/) (it becomes the squash-merge commit message).
- [ ] Branch synchronized with the base by **merge** — never `git rebase` / `git pull --rebase`.
- [ ] Description explains **what** and **why**.
- [ ] Related issues are linked with `Closes #<issue>`.
- [ ] Tests added or updated for behavioural changes (bug fixes include a regression test).
- [ ] Documentation updated where behaviour changed; every new number carries an evidence label and a source.
- [ ] Architecture decision recorded as an ADR; public API / format change backed by an accepted RFC.
- [ ] Local gates are green: `python3 scripts/check-docs.py` (includes the roadmap DAG check).
- [ ] If a roadmap activity changed state, the table was updated and `python3 scripts/roadmap.py render` was run.
- [ ] **Breaking changes** are flagged below and use `!`/`BREAKING CHANGE:` in the commit message.

## Breaking changes

<!-- None — or describe the migration path, affected APIs, and upgrade steps. -->

-

## Screenshots / logs

<!-- For UI or observable behaviour changes, add before/after screenshots or sample output. -->
