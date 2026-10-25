---
id: TASK-594
title: Publish the VS Code extension from the release workflow
status: Done
assignee:
  - '@Lux'
created_date: '2026-10-25 17:01'
updated_date: '2026-10-25 17:09'
labels: []
dependencies: []
ordinal: 586000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The extension was never published: private, version 0.0.0, publisher lumiose. The user created the Marketplace publisher itsjavi and chose lockstep versioning (decision-89). Build the release automation: one job after the Binaries workflow packages the five platform .vsix files, attaches them to the GitHub release and publishes them to the VS Code Marketplace (Microsoft Entra ID, since Azure DevOps global PATs are retired on 2026-12-01) and Open VSX, gated by LUMIOSE_PUBLISH like npm.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 lumiose-vscode is versioned in lockstep: pnpm release:version bumps packages/vscode/package.json, and it is at the current Lumiose version
- [x] #2 The extension's publisher is itsjavi (extension ID itsjavi.lumiose-vscode), and docs use that ID
- [x] #3 The listing has a repository, a license and an icon, so vsce packages without --allow-missing-repository or --skip-license
- [x] #4 On a v<x.y.z> tag, release.yml packages the .vsix of every supported target from the Binaries workflow's compiler artifacts
- [x] #5 A real release (LUMIOSE_PUBLISH) attaches the .vsix files to the GitHub release and publishes them to the VS Code Marketplace and Open VSX; a dry run only packages them
- [x] #6 Pre-release versions (x.y.z-*) attach the .vsix files to the GitHub release but publish to neither registry
- [x] #7 The setup a maintainer must do (publisher, Azure identity, Open VSX namespace, secrets and variables) is documented
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Solo takeover by Lux (standalone session) of Photon's release workflow and Beacon's extension package.
- Lockstep: scripts/release.ts bumps packages/vscode/package.json through VERSIONED_FILES (private, so not in the npm package set); the extension starts at 0.8.0. release.test.ts covers it.
- Listing: publisher itsjavi, repository, homepage, bugs, LICENSE (copy of the root one) and icon.png (the site's favicon orb rendered at 256 px); scripts/package.ts drops --allow-missing-repository and --skip-license and gains --all.
- release.yml: vscode job (after binaries, also on dry runs) packages all five targets on one runner from the compiler-* artifacts; github-release attaches them; vscode-marketplace (Entra ID through azure/login v3.1.0 and vsce --azure-credential, environment vscode-marketplace, warns without VSCE_AZURE_CLIENT_ID/TENANT_ID) and vscode-open-vsx (OVSX_PAT for the first version, then --trusted-publishing) publish real x.y.z releases after npm. vsce packages x.y.z-* versions, so pre-releases still get GitHub release files.
- Added ovsx ^1.3.0 to the extension's devDependencies.
- Evidence: release tests 18/18, extension typecheck and tests (20), actionlint on release.yml, docs:check, oxlint and oxfmt clean. package.ts --all produced five .vsix files with the right TargetPlatform and compiler binary each (with stand-in binaries copied from darwin-arm64, removed afterwards); the darwin-arm64 .vsix has Publisher=itsjavi, Version=0.8.0.
- Not verified: the jobs on GitHub Actions (needs a pushed tag) and both registry sign-ins (need the user's setup, TASK-595); test:vscode (real VS Code) was not run after the extension ID change in its suite.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The extension is versioned in lockstep with Lumiose (decision-89) under the itsjavi publisher, and release.yml packages the .vsix of every platform, attaches them to the GitHub release and publishes them to the VS Code Marketplace (Entra ID) and Open VSX on real x.y.z releases. The one-time setup is in packages/vscode/README.md (Releases); the first publish and its verification are TASK-595.
<!-- SECTION:FINAL_SUMMARY:END -->
