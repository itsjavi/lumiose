import { Suspense } from "lumen";

async function Slow() {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return <p id="slow-content">slow content</p>;
}

// A page with its own boundary: navigating here commits at once and shows the fallback.
export default function SlowPage() {
  return (
    <section>
      <h1 id="slow">Suspense</h1>
      <Suspense fallback={<p id="slow-fallback">loading…</p>}>
        <Slow />
      </Suspense>
    </section>
  );
}
