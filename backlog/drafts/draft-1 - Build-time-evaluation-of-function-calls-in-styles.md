---
id: DRAFT-1
title: Build-time evaluation of $ function calls in styles
status: Draft
assignee: []
created_date: '2026-10-08 16:27'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Postponed by the user (2026-10-08). Idea: allow $space(2) in style blocks by evaluating pure functions from .ts modules at build time via Vite's module runner (as vanilla-extract does). Trade-offs: slower builds, functions must be pure, and the wasm playground compiler could not evaluate them. Syntax/DX: needs user approval before any work.
<!-- SECTION:DESCRIPTION:END -->
