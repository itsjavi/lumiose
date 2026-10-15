// Drawer's prop types (TASK-382). Type-level: `pnpm typecheck` checks the JSX below and its
// `@ts-expect-error` lines; the runtime part only keeps Vitest happy. Never rendered.
import { signal } from "lumiose";
import { expect, it } from "vitest";
import { Drawer } from "./drawer.tsx";

export function Typed() {
  const open = signal(false);
  return (
    <>
      <Drawer.Root bind:open={open} swipeDirection="right">
        <Drawer.Trigger class="trigger">Menu</Drawer.Trigger>
        <Drawer.Popup class="drawer" closedby="closerequest">
          <Drawer.Title>Menu</Drawer.Title>
          <Drawer.Description>Pages</Drawer.Description>
          <Drawer.Content tabindex={0} />
          <Drawer.Close value="done">Done</Drawer.Close>
        </Drawer.Popup>
      </Drawer.Root>
      <Drawer.Root open={open()} onOpenChange={(next: boolean) => open.set(next)} />
      {/* @ts-expect-error: a drawer swipes up, down, left or right */}
      <Drawer.Root swipeDirection="sideways" />
      {/* @ts-expect-error: bind:open takes a boolean signal */}
      <Drawer.Root bind:open={signal("x")} />
    </>
  );
}

it("is checked by the type checker", () => {
  expect(typeof Typed).toBe("function");
});
