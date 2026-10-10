// The page payload in the browser (decision-33), on the hydration path: the island loader (and the
// client-rendered SPA start) passes each `<script type="application/json" data-l-payload>` here
// before the island records of its chunk. The server values of a scoped state wait until its
// factory runs, then replace what the factory created, before the island that asked reads it; a
// state that already exists when its values arrive gets them at once.
import { batch } from "../core/effect.ts";
import { untrack } from "../core/reactive.ts";
import { generation, setStateRestore } from "../core/state.ts";
import { decodeData } from "../server/serialize.ts";

/** A payload as the server writes it: `s` holds scoped state values by state id. */
export interface Payload {
  s?: Record<string, unknown>;
}

/** Values by member: "" for the instance itself, else a top-level key of the returned object. */
type Values = Record<string, unknown>;

const pending: Record<string, Values> = {};
/** Instances by id with their generation, for values that arrive late (`resetStates()` drops them). */
const live: Record<string, [instance: unknown, generation: number]> = {};

/** Writes server values in: signals through `set`, stores by replacing their keys (untracked). */
function write(instance: unknown, values: Values): void {
  untrack(() =>
    batch(() => {
      for (const key in values) {
        const target = (key ? (instance as Values)[key] : instance) as Values;
        const value = values[key] as Values;
        if (typeof target == "function") {
          (target as unknown as { set(value: unknown): void }).set(value);
        } else {
          if (Array.isArray(target)) target.length = 0;
          else for (const k in target) delete target[k];
          Object.assign(target, value);
        }
      }
    }),
  );
}

export function receivePayload(payload: Payload): void {
  for (const id in payload.s) {
    const values = decodeData(payload.s[id]) as Values;
    const known = live[id];
    if (known?.[1] === generation) write(known[0], values);
    else pending[id] = values;
  }
}

setStateRestore((read, value) => {
  // States without an id (never sent) are kept under "undefined", which no payload uses.
  const id = (read as { $$id?: string }).$$id!;
  live[id] = [value, generation];
  if (id in pending) {
    write(value, pending[id]!);
    delete pending[id];
  }
});
