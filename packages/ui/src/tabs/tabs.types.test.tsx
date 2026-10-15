// Tabs' prop types (TASK-359). Type-level: `pnpm typecheck` checks the JSX below and its
// `@ts-expect-error` lines; the runtime part only keeps Vitest happy. Never rendered.
import { signal } from "lumiose";
import { expect, it } from "vitest";
import { Tabs } from "./tabs.tsx";

export function Typed() {
  const tab = signal("a");
  const open = signal(false);
  return (
    <>
      <Tabs.Root bind:value={tab} class="tabs" orientation="vertical">
        <Tabs.List aria-label="Tabs" activateOnFocus loopFocus={false}>
          <Tabs.Tab value="a" disabled>
            A
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="a" class="panel" />
      </Tabs.Root>
      <Tabs.Root value={tab()} onValueChange={(next: string) => tab.set(next)} />
      {/* bind:value on the element itself, as on any bindable custom element. */}
      <lu-tabs bind:value={signal<string | null>(null)} />
      {/* @ts-expect-error: bind:value takes a string signal */}
      <Tabs.Root bind:value={open} />
      {/* @ts-expect-error: a tab needs its value */}
      <Tabs.Tab>A</Tabs.Tab>
      {/* @ts-expect-error: orientation is horizontal or vertical */}
      <Tabs.Root orientation="diagonal" />
    </>
  );
}

it("is checked by the type checker", () => {
  expect(typeof Typed).toBe("function");
});
