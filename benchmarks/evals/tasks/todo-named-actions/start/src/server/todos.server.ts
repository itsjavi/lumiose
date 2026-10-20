// Todos, kept in memory for this demo.
export interface Todo {
  id: number;
  title: string;
  done: boolean;
}

let nextId = 3;
const todos: Todo[] = [
  { id: 1, title: "Buy milk", done: false },
  { id: 2, title: "Write tests", done: true },
];

export function listTodos(): Todo[] {
  return todos.map((todo) => ({ ...todo }));
}

export function addTodo(title: string): Todo {
  const todo = { id: nextId++, title, done: false };
  todos.push(todo);
  return todo;
}

export function toggleTodo(id: number): void {
  const todo = todos.find((t) => t.id === id);
  if (todo) todo.done = !todo.done;
}

export function removeTodo(id: number): void {
  const index = todos.findIndex((t) => t.id === id);
  if (index >= 0) todos.splice(index, 1);
}
