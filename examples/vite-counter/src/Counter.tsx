import { signal } from "lumen";

export function Counter({ start = 0 }: { start?: number }) {
  const count = signal(start);
  return (
    <section class="counter">
      <h2>Counter</h2>
      <button class={{ hot: count() > 5 }} onClick={() => count.update((c) => c + 1)}>
        Clicked {count()} times
      </button>
      <button onClick={() => count.set(start)}>Reset</button>
    </section>
  );
}
