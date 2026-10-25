---
id: DRAFT-10
title: 'Language server and VS Code: .sjsx'
status: Draft
assignee:
  - '@Beacon'
created_date: '2026-10-25 04:12'
updated_date: '2026-10-25 04:35'
labels:
  - sjsx
  - editor
milestone: m-15
dependencies:
  - DRAFT-6
  - DRAFT-7
  - DRAFT-8
priority: medium
ordinal: 589000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decision-88: the language server and the VS Code extension support `.sjsx` (packages/language-server, packages/vscode).

- **Language server.** Document selectors and file kinds take `.sjsx` (server.ts, workspace.ts, stsx-mode.ts, providers.ts, project-styles.ts, snippets.ts), in Lumiose mode and in stsx mode:
  - JavaScript features through the `X.sjsx.jsx` shadows (completion, hover, go to definition, rename, diagnostics with checkJs);
  - CSS features in style blocks;
  - class names between JSX and blocks;
  - the compiler's diagnostics.
- **VS Code.** A second language (`sjsx`, extension `.sjsx`, named Styled JSX) in package.json, with a grammar that embeds `source.js.jsx` where syntaxes/stsx.tmLanguage.json embeds `source.tsx`. Both grammars come from one source, so they stay alike.
- **Tests.** Tokenizer snapshot tests for `.sjsx`, the language server's tests for a `.sjsx` file in both modes, and the extension's integration suite.
- **README** of the extension.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The language server gives .sjsx files JavaScript, CSS and class-name features in Lumiose and stsx modes
- [ ] #2 VS Code registers Styled JSX (.sjsx) with a grammar generated from the same source as .stsx; tokenizer, server and extension tests cover it
<!-- AC:END -->
