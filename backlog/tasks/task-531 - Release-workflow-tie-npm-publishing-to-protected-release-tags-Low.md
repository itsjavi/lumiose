---
id: TASK-531
title: 'Release workflow: tie npm publishing to protected release tags (Low)'
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-23 18:09'
labels:
  - security
dependencies: []
priority: medium
ordinal: 524000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
0.6.0 delta security review (Prism, 2026-10-23). .github/workflows/release.yml's publish job has id-token: write without a GitHub environment, so npm trusted publishing accepts any run of release.yml from any ref: a write-access user or stolen token could run it on a branch with a modified scripts/publish.ts via workflow_dispatch and publish arbitrary versions. Same exposure as the old repo-wide NPM_TOKEN, but the OIDC variables now reach every step of the job, the workspace install included. Fix: add environment: npm-publish to the publish job, run the dry run in a job without id-token, and (user actions on GitHub and npm) restrict the environment to v* and @lumiose/*@* tags (optionally with a required reviewer), name the environment in each package's trusted publisher, protect release tags with a ruleset, delete the NPM_TOKEN secret and enable disallow-tokens.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The publish job runs in a tag-restricted environment that npm's trusted publisher names, and a dry run has no id-token
<!-- AC:END -->
