// Collapsible's and Accordion's prop types (TASK-370). Type-level: `pnpm typecheck` checks the JSX
// below and its `@ts-expect-error` lines; the runtime part only keeps Vitest happy. Never rendered.
import { signal } from "lumiose";
import { expect, it } from "vitest";
import { Accordion } from "../accordion/accordion.tsx";
import { Collapsible } from "./collapsible.tsx";

export function Typed() {
  const open = signal(false);
  const value = signal<string[]>([]);
  const tab = signal("a");
  return (
    <>
      <Collapsible.Root bind:open={open} class="keys" name="group" disabled>
        <Collapsible.Trigger class="trigger">Keys</Collapsible.Trigger>
        <Collapsible.Panel class="panel" />
      </Collapsible.Root>
      <Collapsible.Root open={open()} onOpenChange={(next: boolean) => open.set(next)} />
      <Accordion.Root bind:value={value} multiple orientation="horizontal" loopFocus={false}>
        <Accordion.Item value="a" disabled onOpenChange={(next: boolean) => open.set(next)}>
          <Accordion.Header aria-level={2}>
            <Accordion.Trigger>A</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel />
        </Accordion.Item>
      </Accordion.Root>
      <Accordion.Root value={value()} onValueChange={(next: string[]) => value.set(next)} />
      {/* @ts-expect-error: bind:open takes a boolean signal */}
      <Collapsible.Root bind:open={tab} />
      {/* @ts-expect-error: an accordion's value is a list */}
      <Accordion.Root bind:value={tab} />
      {/* @ts-expect-error: the item's open state comes from the root */}
      <Accordion.Item open />
      {/* @ts-expect-error: orientation is horizontal or vertical */}
      <Accordion.Root orientation="diagonal" />
    </>
  );
}

it("is checked by the type checker", () => {
  expect(typeof Typed).toBe("function");
});
