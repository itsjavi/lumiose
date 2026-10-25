---
id: TASK-595
title: First publish of the VS Code extension to the Marketplace and Open VSX
status: To Do
assignee:
  - '@Lux'
created_date: '2026-10-25 17:09'
updated_date: '2026-10-25 18:03'
labels: []
dependencies:
  - TASK-594
ordinal: 587000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-594 automated the releases; publishing needs the user's one-time setup (packages/vscode/README.md, Releases), then a Lumiose release verifies it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The next Lumiose release attaches the five .vsix files to its GitHub release and the extension is installable from the Marketplace and Open VSX
- [ ] #2 After the first Open VSX version, the trusted publisher is registered and OVSX_PAT is deleted
- [ ] #3 getting-started.md and the extension README drop the 'until then, build it' wording
- [ ] #4 The user set up Marketplace sign-in (Entra ID application with a federated credential for the vscode-marketplace environment, added to the lumiose publisher; VSCE_AZURE_CLIENT_ID and VSCE_AZURE_TENANT_ID variables), or chose the manual upload
- [ ] #5 The user created the lumiose Open VSX namespace and the OVSX_PAT secret
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The user switched the Marketplace publisher from itsjavi to lumiose (2026-10-25): the extension ID is lumiose.lumiose-vscode, and the Open VSX namespace is lumiose.
<!-- SECTION:NOTES:END -->
