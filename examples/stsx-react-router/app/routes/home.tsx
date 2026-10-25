import { Counter } from "../components/Counter.stsx";
import type { Route } from "./+types/home";

export function loader() {
  return { start: 40, renderedAt: new Date().toISOString() };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <section>
      <h1>Home</h1>
      <p>Server-rendered at {loaderData.renderedAt}; the counter starts from loader data.</p>
      <Counter start={loaderData.start} />
    </section>
  );
}
