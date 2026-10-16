// Autocomplete's prop types (TASK-377). Type-level: `pnpm typecheck` checks the JSX below and its
// `@ts-expect-error` lines; the runtime part only keeps Vitest happy. The JSX is never rendered.
import { signal } from "lumiose";
import { expect, it } from "vitest";
import { Autocomplete } from "./autocomplete.tsx";

export function Typed() {
  const query = signal("");
  const open = signal(false);
  return (
    <>
      <Autocomplete.Root
        bind:value={query}
        bind:open={open}
        mode="both"
        filter="startsWith"
        openOnInputClick
        name="q"
      >
        <Autocomplete.Input placeholder="Search" />
        <Autocomplete.Popup sideOffset={4}>
          <Autocomplete.List>
            <Autocomplete.Item value="a" label="A" />
          </Autocomplete.List>
          <Autocomplete.Empty>Nothing</Autocomplete.Empty>
        </Autocomplete.Popup>
      </Autocomplete.Root>
      {/* @ts-expect-error: the text is a string */}
      <Autocomplete.Root bind:value={signal(["a"])} />
      {/* @ts-expect-error: one of Base UI's modes */}
      <Autocomplete.Root mode="always" />
      {/* @ts-expect-error: "none" is a mode, not a filter */}
      <Autocomplete.Root filter="none" />
      <Autocomplete.Root autoHighlight keepHighlight submitOnItemClick limit={5} />
      {/* @ts-expect-error: limit is a number */}
      <Autocomplete.Root limit="5" />
    </>
  );
}

it("type-checks (see pnpm typecheck)", () => {
  expect(Typed).toBeTypeOf("function");
});
