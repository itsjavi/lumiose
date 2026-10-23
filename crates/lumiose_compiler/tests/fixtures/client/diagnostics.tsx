// Reactivity diagnostics: LUM2001 stale derived value, LUM2002 write during render, LUM2003
// reactive early return, LUM2004 component called as a function, LUM2005 children inserted
// twice, LUM2006 reactive index read in row setup.
import { signal } from "lumiose";
import { Card } from "./Card.stsx";

const shared = signal(0);

export function Child(props: { name: string; children?: unknown }) {
  const upper = props.name.toUpperCase();
  const { name } = props;
  const once = signal(props.name);
  shared.set(1);
  if (!props.name) {
    return null;
  }
  return (
    <div title={upper} data-name={name} data-once={once()}>
      {props.children}
      {props.children}
      {Card({ title: "x" })}
      <span>{shared.set(2)}</span>
    </div>
  );
}

export function Rows(props: { items: string[] }) {
  return (
    <ul>
      {props.items.map((item, i) => {
        const position = i;
        return <li data-i={i}>{position}: {item}</li>;
      })}
    </ul>
  );
}

// LUM2003 is an error on a signal or accessor read and a warning on a prop read (decision-77),
// also through a derived local and in a `switch`.
export function Account(props: { user: () => string | null; kind: string }) {
  const kind = props.kind;
  switch (kind) {
    case "guest":
      return null;
  }
  if (!props.user()) return <p>Sign in</p>;
  return <p>{props.user()}</p>;
}

// LUM2001 also reports a signal's value copied into a local (TASK-529); `peek()` reads it once
// on purpose.
export function Counter() {
  const count = signal(0);
  const n = count();
  const start = count.peek();
  return (
    <button onClick={() => count.update((c) => c + 1)}>
      {n} from {start}
    </button>
  );
}
