// Runs once per document load, before the SPA hydrates (decision-49, TASK-295). Its top-level
// `await` completes first: the root layout's onMount finds `ran` set.
const state = window as unknown as { clientEntry?: { runs: number; ran: boolean } };
state.clientEntry = { runs: (state.clientEntry?.runs ?? 0) + 1, ran: false };
await Promise.resolve();
state.clientEntry.ran = true;

export {};
