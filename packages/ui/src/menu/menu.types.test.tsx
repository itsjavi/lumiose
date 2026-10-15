// Menu's prop types (TASK-357). Type-level: `pnpm typecheck` checks the JSX below and its
// `@ts-expect-error` lines; the runtime part only keeps Vitest happy. The JSX is never rendered.
import { signal } from "lumiose";
import { expect, it } from "vitest";
import { Menu } from "./menu.tsx";

export function Typed() {
  const open = signal(false);
  const pinned = signal(false);
  const sort = signal("name");
  return (
    <>
      {/* bind: stands in for a prop and its onXChange (decision-62, TASK-360). */}
      <Menu.Root bind:open={open}>
        <Menu.Trigger class="button">Edit</Menu.Trigger>
        <Menu.Popup side="inline-end" align="center" sideOffset={4} alignOffset={-4}>
          <Menu.Item onClick={() => {}} disabled label="Rename" closeOnClick={false}>
            Rename…
          </Menu.Item>
          <Menu.LinkItem href="/help" closeOnClick>
            Help
          </Menu.LinkItem>
          <Menu.CheckboxItem bind:checked={pinned}>Pinned</Menu.CheckboxItem>
          <Menu.CheckboxItem
            checked={pinned()}
            onCheckedChange={(next: boolean) => pinned.set(next)}
          >
            Pinned
          </Menu.CheckboxItem>
          <Menu.CheckboxItem defaultChecked>Wrap</Menu.CheckboxItem>
          <Menu.Separator />
          <Menu.Group>
            <Menu.GroupLabel>Sort by</Menu.GroupLabel>
            <Menu.RadioGroup bind:value={sort}>
              <Menu.RadioItem value="name">Name</Menu.RadioItem>
            </Menu.RadioGroup>
          </Menu.Group>
          <Menu.SubmenuRoot bind:open={open}>
            <Menu.SubmenuTrigger>Share</Menu.SubmenuTrigger>
            <Menu.Popup />
          </Menu.SubmenuRoot>
        </Menu.Popup>
      </Menu.Root>
      {/* @ts-expect-error: bind:open takes a boolean signal */}
      <Menu.Root bind:open={sort} />
      {/* @ts-expect-error: bind:checked takes a boolean signal */}
      <Menu.CheckboxItem bind:checked={sort} />
      {/* @ts-expect-error: bind:value takes a string signal */}
      <Menu.RadioGroup bind:value={pinned} />
      {/* @ts-expect-error: a radio item needs its value */}
      <Menu.RadioItem>Name</Menu.RadioItem>
      {/* @ts-expect-error: side is a side of the trigger */}
      <Menu.Popup side="middle" />
      {/* @ts-expect-error: an item is disabled with a boolean, as aria-disabled */}
      <Menu.Item disabled="disabled" />
      {/* @ts-expect-error: a <div> has no href */}
      <Menu.Popup href="/" />
    </>
  );
}

it("is checked by the type checker", () => {
  expect(typeof Typed).toBe("function");
});
