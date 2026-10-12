---
id: TASK-268
title: 'Proposal: member signals as binding sources without a closure'
status: To Do
assignee:
  - Lux
created_date: '2026-10-12 22:52'
labels:
  - compiler
  - performance
  - proposal
dependencies: []
priority: low
ordinal: 270000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in TASK-245. For {row.label()} the compiler emits insertText(text, () => row.label()), while the hand-compiled jsfb reference and doc-2 §5.2 pass the signal itself (bind(text, row.label, setText)). Identifier calls ({count()}) already pass the callee, but a zero-argument member call may need its receiver (date.toISOString(), store.method()), so passing row.label unbound is only safe when the member is known to be a signal. Cost of the closure in the jsfb app: 36 bytes per row (heap 1.804 vs 1.768 MB per 1k rows) and roughly 0.1-0.2 ms of script on 03_update10th1k_x16 at 4x throttling (totals within noise in same-browser A/B). Options: (a) keep the closure (current; correct for any receiver); (b) type-directed: pass the member when its declared type in the module is lumiose's Signal/ReadonlySignal (needs a small type resolution of local interfaces and signal<T>() generics); (c) a contract change, e.g. a runtime helper that binds obj[key] once when it is a signal. Needs a decision from Lux (and the user for any new API name).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A decision is recorded: keep the closure, or a specified rule (and contract change) the compiler can apply safely
<!-- AC:END -->
