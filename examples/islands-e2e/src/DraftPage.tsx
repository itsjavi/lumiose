import { Draft } from "./Draft.stsx";

/** `/draft`: an island guarding unsaved changes, and a plain link outside it (TASK-549). */
export function DraftPage() {
  return (
    <main>
      <h1>Draft</h1>
      <Draft client:load />
      <p>
        <a id="away" href="/elsewhere">
          Elsewhere
        </a>
      </p>
    </main>
  );
}
