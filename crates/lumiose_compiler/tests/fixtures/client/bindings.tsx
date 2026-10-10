// Attribute bindings: dynamic attributes and properties bind with hoisted apply functions,
// static expressions are written once, and `count()` of a stable binding is passed directly.
import { signal, untrack } from "lumiose";

const title = "Hello";
let mutable = signal("a");

export function Bindings(props: { href: string }) {
  const count = signal(0);
  const label = () => `Count: ${count()}`;
  mutable = signal("b");
  return (
    <div title={title} data-count={count()} aria-label={label()} data-m={mutable()}>
      <a href={props.href} target={title + "x"}>link</a>
      <input value={count()} checked={count() > 1} indeterminate={count() > 2} />
      <input value="static" checked />
      <span>{count()}</span>
      <span>{`n=${count()}`}</span>
      <span>{title}</span>
      <span>{untrack(count)}</span>
      <b>{count() * 2} items</b>
      <i textContent={label()} />
    </div>
  );
}
