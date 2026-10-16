// `lumiose`'s APIs that make a value or return a constant are not signal reads (TASK-349): an
// object literal that calls them is not a stale derived value (no LUM2001), spread or passed in
// JSX. A prop read in the same object still is.
import { createContext, signal, useId } from "lumiose";

const Ctx = createContext<{ id: string; open: () => boolean }>();

export function Root(props: { children?: JSX.Element }) {
  const context = { id: useId(), open: signal() };
  return <Ctx value={context}>{props.children}</Ctx>;
}

export function Item(props: { children?: JSX.Element; label: string }) {
  const attrs = { id: useId(), role: "option" };
  const stale = { id: useId(), label: props.label };
  return (
    <div {...attrs} title={stale.label}>
      {props.children}
    </div>
  );
}
