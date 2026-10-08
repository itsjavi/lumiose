import { Counter } from "./Counter.tsx";
import { Todos } from "./Todos.tsx";

export function App() {
  return (
    <main>
      <h1>Lumen + Vite</h1>
      <Counter start={0} />
      <Todos />
    </main>
  );
}
