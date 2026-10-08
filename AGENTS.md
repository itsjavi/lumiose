# Project agent workflow

## Purpose and scope

Work autonomously on the user's requested scope, using the Backlog CLI
to plan, assign, execute, and document tasks.

When asked to work through the backlog, continue until all eligible
tasks are complete or the remaining tasks require user input.

Discussion, review, and planning requests do not automatically start
implementation.

Ask about consequential unresolved product, architecture, security,
or destructive decisions. Resolve routine implementation details
using project conventions and judgment.

Syntax and developer-experience decisions (authoring syntax,
public API shape, file formats) need the user's explicit approval
before they are recorded. An exploratory question ("would X be
possible?") is not approval; keep such options as proposals. All
other technical, architecture, performance and process decisions
are delegated to the orchestrator, who records them with their
rationale (decision-16).

## Agent identity and roster

Read agents.json at the start of each session. If the file does not
exist, create one specific for this project, based on the structure
of `agents.example.json` (no need to use it verbatim; agents and roles
can vary per project).

Each session operates under one agent nickname. The orchestrator
assigns nicknames when starting workers. A standalone session uses
defaultAgent unless the user specifies otherwise.

Agent nicknames must match backlog assignee names exactly.

Use the smallest useful number of workers. Delegate independent work
when it provides a clear benefit; handle small or tightly coupled
work directly.

The roster describes roles and permissions. It does not itself
launch workers or enforce filesystem permissions.

## Orchestration and assignment

The default agent is the orchestrator.

The orchestrator:

- Turns agreed requirements into actionable backlog tasks.
- Defines acceptance criteria, dependencies, and priorities.
- Assigns each execution task to one accountable agent.
- Starts workers with their nickname, task scope, and relevant context.
- Coordinates overlapping work, handoffs, and integration.
- Keeps the overall backlog accurate.

In a multiagent run, workers pick up eligible tasks assigned to their
nickname. Workers do not take another agent's tasks without a handoff
or reassignment by the orchestrator.

In a standalone run, the default agent may execute eligible tasks
assigned to any agent within the user's requested scope. Record the
solo takeover in the task notes; reassignment is optional.

An assignment does not override an existing active claim.

Split independently executable work into separate tasks rather than
giving multiple workers concurrent ownership of one task.

## Task execution

Before starting a task:

1. Read its description, acceptance criteria, dependencies, and notes.
2. Confirm it is within scope, unblocked, and permitted by your role.
3. Acquire its active claim.
4. Set its status to In Progress through the Backlog CLI.

While working:

- Keep implementation plans, decisions, blockers, and evidence in
  the task.
- Append progress notes without replacing another agent's notes.
- Keep changes scoped and preserve unrelated work.
- Record newly discovered work as tasks; do not silently expand scope.
- If blocked, record the reason and required next action, then
  release the claim and continue independent eligible work.

Mark a task Done only when:

- Its acceptance criteria are satisfied.
- Relevant validation has passed, with limitations documented.
- Its changes are integrated into the main working tree.
- Any required visual evidence and completion summary are recorded.

Writing workers update their own tasks through the CLI. Read-only
workers return findings and proposed updates to the orchestrator,
which records them.

Do not mark blocked or partially completed work Done.

## Local coordination

The backlog is the source of truth for requirements, assignments,
dependencies, progress, decisions, and completion evidence.

Use .local/coordination/ only for runtime coordination:

- sessions/<session-id>.json: nickname, mode, activity, and owned claims.
- claims/<task-id>/owner.json: owning session and working directory.
- backlog-write.lock/: short-lived lock for backlog mutations.

Acquire task claims by atomically creating their claim directory.
If it already exists, treat the task as claimed.

Create backlog-write.lock/ atomically before mutating the backlog.
Record the owning session, keep the operation brief, and release
the lock afterward.

Do not hold the backlog write lock while implementing, testing,
waiting for workers, or waiting for user input.

Release claims when work finishes, is handed off, or is blocked.
Do not reclaim claims or locks based only on their age: first confirm
the owning session has stopped or explicitly released ownership.

At session startup, reconcile existing claims with the backlog and
live workers before taking new work.

Do not duplicate task descriptions or progress histories in runtime
files. Do not delete another session's coordination state.

## Backlog in the repository

backlog/ is tracked by the main repository. The Backlog CLI
auto-commits its own changes there (`auto_commit: true`). An
auto-commit may include anything already staged, so avoid backlog
mutations while the index holds entries you did not stage.

Update backlog content through the Backlog CLI. One exception: the
CLI cannot write decision bodies, so agents may edit the Context,
Decision, and Consequences sections of decision files directly, and
a decision's `status` field when it is superseded.

Commit remaining backlog changes, such as hand-edited decision
bodies, as part of the regular workflow, either on their own or
together with the work they document. Do not reset, clean, or
rewrite backlog history.

A dirty backlog state between commits is expected and is not a
blocker.

Dirty application state is also not a blocker by itself. Inspect
ownership and overlap, preserve existing changes, and continue work
that can be completed safely.

Application commits remain subject to agents.json permissions and
the existing Git and staged-change rules.

If agents have all finished their work and there are still files
pending to be committed, the default/main agent may do so into
proper commits, before starting any other agents again.

## Shared work and worktrees

Avoid overlapping edits between workers in the same working tree.
The orchestrator assigns distinct file ownership or serializes
conflicting work.

Use worktrees when isolation provides a clear benefit. Record the
working directory in the task claim.

Before closing a worktree, integrate and verify its needed changes
in the main working tree. Remove it only after confirming no needed
work remains.

## Scratch space

Use .local/agents/<nickname>/<session-id>/ for session scratch work.

.local/coordination/ is operational state, not disposable scratch.
Preserve .local/data/ and .local/keep/ if they exist.

canWrite: false still permits an agent to write its own scratch and
session coordination state, but not source files or backlog content.

## Visual progress

For UI work, send screenshots in chat after important visual changes
and at completion.

When requesting a consequential UI decision, show the current result
with a disposable screenshot when practical.

Store final representative screenshots in `backlog/assets/` and link
them from the relevant task. Keep intermediate captures in scratch.

## Files that LLMs and Agents should not use as context

Any file matching these patterns, should not be used as context:

- ./**/*.prompt.txt
- ./**/*.prompt.md

## Other things to keep in mind

From time to time, please format docs and other code via `npx -y oxfmt .`
before comitting if you are only the agent running.
