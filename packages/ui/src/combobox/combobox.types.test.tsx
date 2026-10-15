// Combobox's and Select's prop types (TASK-358). Type-level: `pnpm typecheck` checks the JSX below
// and its `@ts-expect-error` lines; the runtime part only keeps Vitest happy. The JSX is never
// rendered.
import { signal } from "lumiose";
import { expect, it } from "vitest";
import { Select } from "../select/select.tsx";
import { Combobox } from "./combobox.tsx";

export function Typed() {
  const city = signal("ber");
  const tags = signal<string[]>([]);
  const open = signal(false);
  return (
    <>
      {/* bind: stands in for a prop and its onXChange (decision-62, TASK-360). */}
      <Combobox.Root name="city" bind:value={city} bind:open={open} required filter="startsWith">
        <Combobox.Label>City</Combobox.Label>
        <Combobox.Input placeholder="Search" />
        <Combobox.Trigger aria-label="Show cities" />
        <Combobox.Clear aria-label="Clear" />
        <Combobox.Popup side="top" align="end" sideOffset={4}>
          <Combobox.List>
            <Combobox.Group>
              <Combobox.GroupLabel>Germany</Combobox.GroupLabel>
              <Combobox.Item value="ber" label="Berlin" disabled>
                Berlin
              </Combobox.Item>
            </Combobox.Group>
          </Combobox.List>
          <Combobox.Empty>No cities</Combobox.Empty>
          <Combobox.Status>Loading…</Combobox.Status>
        </Combobox.Popup>
      </Combobox.Root>
      <Combobox.Root
        defaultValue="ber"
        onValueChange={(next: string) => city.set(next)}
        onOpenChange={(next: boolean) => open.set(next)}
      />
      <Combobox.Root multiple name="tags" bind:value={tags}>
        <Combobox.Chips removeLabel="Remove" class="chips" />
        <Combobox.Input />
        <Combobox.List side="bottom" />
      </Combobox.Root>
      <Combobox.Root multiple onValueChange={(next: string[]) => tags.set(next)} />
      {/* @ts-expect-error: a single combobox binds a string signal */}
      <Combobox.Root bind:value={tags} />
      {/* @ts-expect-error: a multiple combobox binds a string[] signal */}
      <Combobox.Root multiple bind:value={city} />
      {/* @ts-expect-error: an item needs its value */}
      <Combobox.Item>Berlin</Combobox.Item>
      {/* @ts-expect-error: filter is one of the modes */}
      <Combobox.Root filter="fuzzy" />
      {/* @ts-expect-error: the input's type is the combobox's */}
      <Combobox.Input type="search" />

      <Select.Root name="fruit" bind:value={city} required autocomplete="off" class="select">
        <Select.Trigger class="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Item value="apple">Apple</Select.Item>
        <Select.Separator />
        <Select.Group label="Citrus">
          <Select.Item value="lime" disabled>
            Lime
          </Select.Item>
        </Select.Group>
      </Select.Root>
      <Select.Root defaultValue="apple" onValueChange={(next: string) => city.set(next)} />
      {/* @ts-expect-error: Select binds a string signal */}
      <Select.Root bind:value={tags} />
      {/* @ts-expect-error: a group needs its label */}
      <Select.Group />
      {/* @ts-expect-error: Select picks one value; Combobox has multiple */}
      <Select.Root multiple />
    </>
  );
}

it("type-checks (see pnpm typecheck)", () => {
  expect(Typed).toBeTypeOf("function");
});
