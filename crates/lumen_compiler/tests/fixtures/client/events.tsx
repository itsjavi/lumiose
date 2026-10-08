// Events: camelCase onX delegated for bubbling events, direct listeners for the others and for
// on:x; row handlers that only capture the item and stable bindings move out of the row.
import { signal } from "lumen";

const log = (message: string) => console.log(message);

export function Events(props: { onPick: (id: number) => void; items: () => { id: number }[] }) {
  const count = signal(0);
  const reset = () => count.set(0);
  let changing = 0;
  changing = 1;
  return (
    <div onClick={() => count.update((n) => n + 1)} onKeyDown={(e) => log(e.key)} onDblClick={reset}>
      <input onInput={(e) => log(e.currentTarget.value)} onFocus={() => log("focus")} onMouseEnter={reset} on:my-event={reset} on:scroll={() => log("scroll")} />
      <ul>
        {props.items().map((item, index) => (
          <li>
            <button onClick={() => log(String(item.id))}>module</button>
            <button onClick={() => props.onPick(item.id)}>setup</button>
            <button onClick={(e) => { e.preventDefault(); reset(); }}>no item</button>
            <button onClick={() => log(`${index}`)}>index</button>
            <button onClick={() => log(String(changing + item.id))}>mutable</button>
            <button onClick={function () { log(String(this)); }}>function</button>
            <button onPointerDown={() => log(String(item.id))} onWheel={() => log("wheel")}>pointer</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
