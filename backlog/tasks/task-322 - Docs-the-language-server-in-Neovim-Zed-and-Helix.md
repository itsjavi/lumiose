---
id: TASK-322
title: 'Docs: the language server in Neovim, Zed and Helix'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-15 04:03'
updated_date: '2026-10-15 07:41'
labels:
  - docs
  - dx
milestone: m-11
dependencies: []
priority: low
ordinal: 324000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). Per decision-57: document how to run @lumiose/language-server in Neovim, Zed and Helix (file type, root markers, settings), next to the VS Code extension. GitHub highlighting already comes from the .gitattributes mapping the scaffold writes; the GitHub Linguist submission waits until about 200 repositories use .stsx. A JetBrains plugin waits for demand.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The docs give working setups for Neovim, Zed and Helix, checked by hand
- [x] #2 They mention GitHub highlighting through .gitattributes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (batch 3): started.

Docs: docs/guides/editors.md (Guides; linked from Getting started's Editor section): the server settings any editor needs (npx --no-install lumiose-language-server --stdio, .stsx file type, root markers vite.config.ts/package.json, TSX grammar, takeover of .ts/.tsx), Neovim (vim.filetype.add, vim.treesitter.language.register, vim.lsp.config with a cmd function that starts the server in root_dir, vim.lsp.enable), Helix (languages.toml: language-server, an stsx language on the TSX grammar, typescript/tsx overrides, '; inherits: tsx' query files), Zed (state today), other editors, and GitHub highlighting through .gitattributes (AC #2). How each was checked (none of the three editors is installed on this machine, so the official macOS arm64 release builds were downloaded from GitHub into session scratch and run there, against a create-lumiose ssr project with the workspace's language server): Neovim 0.12.6 headless with the documented init.lua: the client attached to a .stsx buffer, the server published TypeScript (TS2322) and Lumiose (LUM3020) diagnostics, hover returned the type plus the Lumiose execution contract, and completion inside the <style> block returned CSS properties; the cmd function works with Neovim started outside the project. Helix 25.07.1: hx --health stsx reports the server, parser and queries; driven through expect with -vvv logging, it started the server (initialize), sent didOpen for the .stsx file and received publishDiagnostics with TS2322 and LUM3020 and documentColor, also when started from a subdirectory (npx); a hover keystroke did not register under expect, so hover in Helix is unchecked. Zed: not installed and not checkable; per Zed's documentation it runs language servers only through extensions, so there is no working Zed setup: the guide says so (and that mapping .stsx to TSX makes Zed's TypeScript server flag style blocks). AC #1 stays open for Zed: TASK-338 proposes a Zed extension, which needs the user (new package, Rust dependency, publishing PR to zed-industries/extensions). Left In Progress for that part; claim released.

User decision, 2026-10-15 (parked decisions review): Zed stays unsupported (TASK-338), so the guide's Zed section, which says so, completes AC #1 together with the checked Neovim and Helix setups.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
guides/editors.md: Neovim and Helix setups checked by hand, Zed documented as unsupported (TASK-338), GitHub highlighting through .gitattributes.
<!-- SECTION:FINAL_SUMMARY:END -->
