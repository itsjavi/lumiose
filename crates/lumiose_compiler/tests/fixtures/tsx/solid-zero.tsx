import "/src/solid-zero.stsx.css";
// @tsx class class zero app
// Solid: `class`, `classList` (dynamic classes for the unused-selector check), zero specificity
// and a custom namespace.
import { createSignal, For } from "solid-js";

export function List(props: { items: string[] }) {
  const [active, setActive] = createSignal(0);
  return (
    <ul class="list app-7nclu0up">
      <For each={props.items}>
        {(item, i) => (
          <li class="app-7nclu0up" classList={{ active: active() === i() }} onClick={() => setActive(i())}>
            {item}
          </li>
        )}
      </For>
      
    </ul>
  );
}
