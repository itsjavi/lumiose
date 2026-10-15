// The opt-in "Used by" list (decision-53, TASK-308): apps in production built with Lumiose, added by
// their owners through a pull request. Only external apps belong here: the Lumiose maintainer's own
// sites do not count, since the list is the usage signal for the stability rules and the 1.0
// criteria (docs/stability.md). Lumiose collects no telemetry.

export interface UsedBy {
  /** The app's or the organization's name. */
  name: string;
  /** The app in production. */
  url: string;
  /** What it is, in one sentence. */
  description: string;
}

/** To add an app, append an entry and open a pull request; keep the list alphabetical. */
export const usedBy: readonly UsedBy[] = [];
