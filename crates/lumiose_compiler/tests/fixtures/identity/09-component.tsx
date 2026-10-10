import { computed, signal } from "lumiose";
import type { JSX } from "lumiose/jsx-runtime";

type Todo = { id: number; text: string; done: boolean };

export function TodoList(props: { initial: Todo[]; onChange?: (todos: Todo[]) => void }): JSX.Element {
  const todos = signal(props.initial);
  const remaining = computed(() => todos().filter((todo) => !todo.done).length);
  const toggle = (id: number) =>
    todos.update((list) => list.map((todo) => (todo.id === id ? { ...todo, done: !todo.done } : todo)));

  return (
    <section class={{ todos: true, empty: todos().length === 0 }}>
      <header>
        <h2>Todos ({remaining()} left)</h2>
      </header>
      {todos().length > 0 ? (
        <ul>
          {todos().map((todo) => (
            <li class={todo.done ? "done" : undefined} onClick={() => toggle(todo.id)}>
              {todo.text}
            </li>
          ))}
        </ul>
      ) : (
        <p>Nothing to do, you're all set!</p>
      )}
      <footer>{remaining() < 2 ? "almost" : "keep going"}</footer>
    </section>
  );
}

export default TodoList
