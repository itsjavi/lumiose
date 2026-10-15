import { Menu } from "@lumiose/ui";
import { signal } from "lumiose";

/**
 * Menu bound to signals: `open` and `onOpenChange`, `bind:checked` on a checkbox item and
 * `bind:value` on a radio group keep them in sync both ways, and items run their handlers.
 */
export function MenuSignals() {
  const open = signal(false);
  const wrap = signal(true);
  const view = signal("list");
  const ran = signal<string[]>([]);
  const run = (name: string) => () => ran.update((list) => [...list, name]);
  return (
    <section>
      <Menu.Root open={open()} onOpenChange={(next) => open.set(next)}>
        <Menu.Trigger class="lu-button">View</Menu.Trigger>
        <Menu.Popup class="lu-menu">
          <Menu.Item onClick={run("refresh")}>Refresh</Menu.Item>
          <Menu.CheckboxItem bind:checked={wrap}>Wrap lines</Menu.CheckboxItem>
          <Menu.Separator />
          <Menu.RadioGroup bind:value={view}>
            <Menu.GroupLabel>Layout</Menu.GroupLabel>
            <Menu.RadioItem value="list">List</Menu.RadioItem>
            <Menu.RadioItem value="grid">Grid</Menu.RadioItem>
          </Menu.RadioGroup>
        </Menu.Popup>
      </Menu.Root>
      <button
        type="button"
        class="lu-button"
        data-testid="open-by-signal"
        onClick={() => open.set(true)}
      >
        Open the menu
      </button>
      <button
        type="button"
        class="lu-button"
        data-testid="toggle-wrap"
        onClick={() => wrap.update((on) => !on)}
      >
        Toggle wrapping
      </button>
      <output data-testid="menu-state">
        open: {String(open())}, wrap: {String(wrap())}, view: {view()}, ran:{" "}
        {ran().join(" ") || "none"}
      </output>
    </section>
  );
}
