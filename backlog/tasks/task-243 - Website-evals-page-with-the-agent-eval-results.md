---
id: TASK-243
title: 'Website: /evals page with the agent eval results'
status: To Do
assignee:
  - Beacon
created_date: '2026-10-11 04:21'
labels:
  - site
  - evals
milestone: m-5
dependencies:
  - TASK-207
priority: medium
ordinal: 245000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-11. Publish the agent evals (doc-5) on a dedicated /evals page, like /benchmarks, once TASK-207 (3 repeats per model) is done, and ideally TASK-208 (the Next.js and React Router baseline). Evals are on hold until the user resumes them, so this waits.
- Content:
  - the method: a fresh project outside the repo, no network or web tools, docs in node_modules only, hidden tests, lumiose check;
  - the task list by category;
  - per model: pass rate, first-attempt lumiose check pass rate, average turns and cost per task, with variance across repeats;
  - the Lumiose revision, model and CLI versions, and the date;
  - failures shown next to passes;
  - a link to the eval results viewer.
- Once TASK-208 exists, show the baseline next to Lumiose.
- Later, the local-model pilot (TASK-209) as its own section.
- Landing: a single line in the 'Explicit, for you and your agent' section (for example '6 models, N tasks, X% passed from the docs alone') linking to /evals. Every number comes from committed results through a content module, as evidence.ts does.
- Rerun on every release: an eval regression already blocks a release (decision-10).
- The page passes the axe suite (decision-39).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 /evals shows the method, tasks, per-model results with variance, versions and date, and failures, all from committed results, and links to the viewer
- [ ] #2 The landing's 'Explicit' section has one line with the headline result, linking to /evals; the baseline (TASK-208) appears when it exists
- [ ] #3 Tests cover the content module, and the axe suite passes on /evals in light and dark
<!-- AC:END -->
