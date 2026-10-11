// Starting points in the sample menu. Each is one `.stsx` file whose default export the preview
// mounts; playground.test.ts compiles them without diagnostics.

export interface Sample {
  id: string;
  label: string;
  code: string;
}

export const samples: Sample[] = [
  {
    id: "counter",
    label: "Counter",
    code: `import { computed, signal } from "lumiose";

// Top-level constants can be used in <style> blocks as $name.
const accent = "#5546ff";
const radius = "10px";

export default function Counter() {
  const count = signal(0);
  const doubled = computed(() => count() * 2);

  return (
    <div class="counter">
      <button onClick={() => count.set(count() + 1)}>Clicked {count()} times</button>
      <Reset onReset={() => count.set(0)} />
      <p>Doubled: {doubled()}</p>
    </div>
  );
}

function Reset(props: { onReset(): void }) {
  return (
    <button class="ghost" onClick={props.onReset}>
      Reset
    </button>
  );
}

// One block at the end of the file styles every component in it.
<style>
  .counter {
    display: grid;
    gap: 0.5rem;
    justify-items: start;
  }
  button {
    padding: 0.5rem 1rem;
    border: 0;
    border-radius: $radius;
    background: $accent;
    color: white;
    font: inherit;
    cursor: pointer;
  }
  .ghost {
    background: transparent;
    color: $accent;
  }
</style>
`,
  },
  {
    id: "todos",
    label: "Todo list",
    code: `import { computed, signal } from "lumiose";

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

export default function Todos() {
  const todos = signal<Todo[]>([
    { id: 1, text: "Write a component", done: true },
    { id: 2, text: "Style it with a <style> block", done: false },
  ]);
  const draft = signal("");
  const left = computed(() => todos().filter((todo) => !todo.done).length);
  let nextId = 3;

  function add(event: SubmitEvent) {
    event.preventDefault();
    const text = draft().trim();
    if (text === "") return;
    todos.set([...todos(), { id: nextId++, text, done: false }]);
    draft.set("");
  }

  function toggle(id: number) {
    todos.set(todos().map((todo) => (todo.id === id ? { ...todo, done: !todo.done } : todo)));
  }

  return (
    <section class="todos">
      <form onSubmit={add}>
        <input bind:value={draft} placeholder="What needs doing?" aria-label="New todo" />
        <button>Add</button>
      </form>
      <ul>
        {todos().map((todo) => (
          <li key={todo.id} class={{ done: todo.done }}>
            <label>
              <input type="checkbox" checked={todo.done} onChange={() => toggle(todo.id)} />
              {todo.text}
            </label>
          </li>
        ))}
      </ul>
      <p>{left()} left</p>
    </section>
  );
}

<style>
  .todos {
    max-width: 24rem;
  }
  form {
    display: flex;
    gap: 0.5rem;
  }
  input:not([type]) {
    flex: 1;
    padding: 0.375rem 0.5rem;
  }
  ul {
    padding: 0;
    list-style: none;
  }
  .done {
    text-decoration: line-through;
    opacity: 0.6;
  }
</style>
`,
  },
  {
    id: "scoped",
    label: "Scoped styles",
    code: `import { signal } from "lumiose";

const theme = { gap: "0.75rem", radius: "12px", hue: "265deg" };

function Badge(props: { label: string }) {
  return <span class="badge">{props.label}</span>;
}

export default function Card() {
  const open = signal(false);

  return (
    <article class="card">
      <h2>
        Scoped styles <Badge label="stsx" />
      </h2>
      <button onClick={() => open.set(!open())}>{open() ? "Hide" : "Show"} details</button>
      {open() && <p>The block at the end of the file styles Card and Badge, and nothing else.</p>}
      <footer>
        <p>A block nested in an element styles only that element's subtree.</p>
        <style>
          p {
            font-size: 0.875rem;
            opacity: 0.7;
          }
        </style>
      </footer>
    </article>
  );
}

// The file's block: every component in this file (Card and Badge).
<style>
  .card {
    display: grid;
    gap: $theme.gap;
    padding: 1rem;
    border: 1px solid color-mix(in oklab, currentColor 20%, transparent);
    border-radius: $theme.radius;
  }
  h2 {
    margin: 0;
    font-size: 1.25rem;
  }
  .badge {
    padding: 0.125rem 0.5rem;
    border-radius: 999px;
    background: oklch(0.92 0.05 $theme.hue);
    color: oklch(0.35 0.15 $theme.hue);
  }
</style>
`,
  },
];

export const defaultSample = samples[0]!;
