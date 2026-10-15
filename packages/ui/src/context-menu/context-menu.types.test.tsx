// Context Menu's prop types (TASK-378). Type-level: `pnpm typecheck` checks the JSX below and its
// `@ts-expect-error` lines; the runtime part only keeps Vitest happy. Never rendered.
import { signal } from "lumiose";
import { expect, it } from "vitest";
import { ContextMenu } from "./context-menu.tsx";

export function Typed() {
  const open = signal(false);
  const checked = signal(true);
  const value = signal("a");
  return (
    <>
      <ContextMenu.Root bind:open={open} disabled>
        <ContextMenu.Trigger tabindex={0} class="area" />
        <ContextMenu.Popup side="top" align="end" sideOffset={4} aria-label="Actions">
          <ContextMenu.Item disabled label="copy">
            Copy
          </ContextMenu.Item>
          <ContextMenu.LinkItem href="/x">Open</ContextMenu.LinkItem>
          <ContextMenu.CheckboxItem bind:checked={checked}>Grid</ContextMenu.CheckboxItem>
          <ContextMenu.RadioGroup bind:value={value}>
            <ContextMenu.GroupLabel>Sort</ContextMenu.GroupLabel>
            <ContextMenu.RadioItem value="a">A</ContextMenu.RadioItem>
          </ContextMenu.RadioGroup>
          <ContextMenu.Separator />
        </ContextMenu.Popup>
      </ContextMenu.Root>
      <ContextMenu.Root open={open()} onOpenChange={(next: boolean) => open.set(next)} />
      {/* @ts-expect-error: bind:open takes a boolean signal */}
      <ContextMenu.Root bind:open={value} />
      {/* @ts-expect-error: sides are top, bottom, left, right, inline-start or inline-end */}
      <ContextMenu.Popup side="middle" />
    </>
  );
}

it("is checked by the type checker", () => {
  expect(typeof Typed).toBe("function");
});
