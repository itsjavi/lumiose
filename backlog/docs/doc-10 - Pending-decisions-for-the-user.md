---
id: doc-10
title: Pending decisions for the user
type: other
created_date: '2026-10-16 22:28'
updated_date: '2026-10-16 22:28'
---
Decisions that need the user, collected while Lux and the workers run unattended (user request, 2026-10-17: "do not block yourself on more questions … postpone them (and their decisions) in a document that can be used later as follow ups").

Each item has:
- what is waiting;
- the options;
- Lux's recommendation;
- what happens meanwhile.

Nothing here is decided until the user answers. Answered items move to the Answered section with the date, and are recorded in the decision or task they belong to.

## Open

### P1. Push main to origin

- **Waiting:** local commits after 4bfc013a (the last push, which the user approved on 2026-10-16). Pushing runs CI, which costs money, so every push needs the user's OK (AGENTS.md).
- **Recommendation:** push once the final M12 batch (TASK-458 to TASK-465) is merged and green, in one push.
- **Meanwhile:** commits stay local. Lux keeps the list of what each push would carry under this item.

### P2. The screen reader pass (TASK-361)

- **Waiting:** the user, who chose on 2026-10-16 to run VoiceOver and NVDA themselves. The per-component checklist is in TASK-361's notes. It also covers Prism's M23 (the announcements of Combobox's Empty and Status).
- **Meanwhile:** nothing blocks on it except publishing (P3).

### P3. Publish @lumiose/ui 0.1.0 (TASK-389)

- **Waiting:** the user's go. Publishing and tagging always need explicit permission (AGENTS.md).
- **Order the user chose on 2026-10-16:**
  1. Prism's review (done, TASK-386);
  2. the screen reader pass (P2);
  3. then publishing.
- **Recommendation:** publish 0.1.0 after P2. Run `pnpm release:version 0.1.0 --package @lumiose/ui` once the pre-release security review (see P4) shows no open High finding.
- **Meanwhile:** Lux prepares the release: the security review, the changelog and the package checks. Lux doesn't tag or publish.

### P4. The security review before the first @lumiose/ui release

- **Not a question:** listed so that the user sees it.
- AGENTS.md asks for an app-security-review before each lumiose minor release. TASK-430 changed form actions (lumiose's action data now carries `FormData`), so Lux runs that review unattended before P3 and records its findings as tasks.

## Answered
