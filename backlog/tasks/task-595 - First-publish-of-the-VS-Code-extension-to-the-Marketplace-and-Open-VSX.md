---
id: TASK-595
title: First publish of the VS Code extension to the Marketplace and Open VSX
status: To Do
assignee:
  - '@Lux'
created_date: '2026-10-25 17:09'
updated_date: '2026-10-25 18:36'
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
- [x] #3 getting-started.md and the extension README drop the 'until then, build it' wording
- [ ] #4 The user created the lumiose Open VSX namespace and the OVSX_PAT secret
- [ ] #5 The user added a trusted publishing policy on the lumiose Marketplace publisher for itsjavi/lumiose and release.yml
- [ ] #6 v0.8.1's extension is published with a manual run (gh workflow run release.yml -f vscode_release=v0.8.1), since its release ran before the registry setup
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The user switched the Marketplace publisher from itsjavi to lumiose (2026-10-25): the extension ID is lumiose.lumiose-vscode, and the Open VSX namespace is lumiose.

The Marketplace job now uses trusted publishing (vsce publish --oidc) instead of Microsoft Entra ID, and the registry jobs publish the GitHub release's .vsix files, also on a manual run with vscode_release. The Marketplace's web upload takes one file, which does not fit one .vsix per platform.

Marketplace trusted publishing has not launched (2026-10-25): vsce 4's --oidc is hidden and unannounced, and the Marketplace's token exchange still answers TrustedPublishingNotSupportedException (microsoft/vscode-vsce#1275; the Marketplace team targeted the week of 2026-10-30). The Marketplace job warns until the repository variable VSCE_TRUSTED_PUBLISHING is true.

Docs (2026-10-25, the user is publishing the extension): the Editors guide (docs/guides/editors) has a VS Code section (Marketplace install, the .vsix for forks, TypeScript 7, the bundled or workspace server, takeover mode); getting started, the extension README and the STSX pages (README, type-checking) link to it, without the 'until then, build it' wording.
<!-- SECTION:NOTES:END -->
