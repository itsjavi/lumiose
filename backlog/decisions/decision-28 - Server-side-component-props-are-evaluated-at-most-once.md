---
id: decision-28
title: Server-side component props are evaluated at most once
date: '2026-10-09 05:35'
status: accepted
---
## Context

Props are getter objects (doc-2 §1): `<FilterFields labels={listLabels()} />` compiles to `get labels() { return listLabels() }`. On the client that keeps props reactive. On the server nothing is reactive, yet each read re-runs the expression: in the fullstack benchmark `Options` read `props.labels` once per option, so the labels query ran 16 times per request, where React Router and Next run it once (TASK-136). TASK-78 already evaluates trivially safe prop expressions eagerly on the server. Decision-16 delegates runtime-semantics and performance choices that do not change what developers write to Lux.

## Decision

On the server, a component's dynamic props are evaluated **lazily and at most once per component instance**: the first read runs the expression and caches the value; later reads return it. Unread props are never evaluated. Client props stay reactive getters. Trivially safe expressions keep TASK-78's eager path.

This matches what developers expect from writing JSX "like React" (a prop is a value during one render) and removes repeated work, including repeated data access, from server renders.

## Consequences

- A prop expression with side effects runs once per instance on the server instead of once per read (documented under props in the docs).
- The contract (doc-2 §1) and the server runtime or codegen change; client/server parity tests cover it.
- Implemented in TASK-151.
