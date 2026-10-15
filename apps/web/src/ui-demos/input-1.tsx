// Generated from packages/ui/docs/input.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Input } from "@lumiose/ui";
import { signal } from "lumiose";

const BOOKS = ["Dune", "Emma", "Ulysses", "Middlemarch"];

export function BookSearch() {
  const query = signal("");
  const found = () => BOOKS.filter((book) => book.toLowerCase().includes(query().toLowerCase()));
  return (
    <search>
      <Input type="search" aria-label="Search books" bind:value={query} class="lu-input" />
      <p>{found().join(", ") || "No books."}</p>
    </search>
  );
}
