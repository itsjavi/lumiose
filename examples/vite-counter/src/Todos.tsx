import { signal, type Signal } from "lumen";

interface Todo {
  id: number;
  title: string;
  done: Signal<boolean>;
}

let nextId = 1;

export function Todos() {
  const todos = signal<Todo[]>([]);
  const draft = signal("");
  const remaining = () => todos().filter((todo) => !todo.done()).length;
  const add = (event: SubmitEvent) => {
    event.preventDefault();
    const title = draft().trim();
    if (title === "") return;
    todos.update((list) => [...list, { id: nextId++, title, done: signal(false) }]);
    draft.set("");
  };
  const remove = (id: number) => todos.update((list) => list.filter((todo) => todo.id !== id));
  return (
    <section class="todos">
      <h2>Todos</h2>
      <form onSubmit={add}>
        <input placeholder="What needs doing?" bind:value={draft} />
        <button type="submit">Add</button>
      </form>
      <ul>
        {todos().map((todo) => (
          <li key={todo.id} class={{ done: todo.done() }}>
            <label>
              <input type="checkbox" bind:checked={todo.done} />
              {todo.title}
            </label>
            <button class="remove" onClick={() => remove(todo.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <p class="remaining">
        {remaining()} of {todos().length} left
      </p>
    </section>
  );
}
