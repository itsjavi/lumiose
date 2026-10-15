// Generated from packages/ui/docs/menu.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Menu } from "@lumiose/ui";
import { signal } from "lumiose";

export function EditorMenu() {
  const formatted = signal(0);
  const wrap = signal(true);
  const indent = signal("spaces");
  return (
    <>
      <Menu.Root>
        <Menu.Trigger class="lu-button">View</Menu.Trigger>
        <Menu.Popup class="lu-menu" align="end">
          <Menu.Item onClick={() => formatted.set(formatted() + 1)}>Format document</Menu.Item>
          <Menu.Item disabled>Fold all</Menu.Item>
          <Menu.Separator />
          <Menu.CheckboxItem bind:checked={wrap}>Wrap lines</Menu.CheckboxItem>
          <Menu.RadioGroup bind:value={indent}>
            <Menu.GroupLabel>Indent with</Menu.GroupLabel>
            <Menu.RadioItem value="spaces">Spaces</Menu.RadioItem>
            <Menu.RadioItem value="tabs">Tabs</Menu.RadioItem>
          </Menu.RadioGroup>
        </Menu.Popup>
      </Menu.Root>
      <p>
        Formatted {formatted()} times, lines {wrap() ? "wrap" : "do not wrap"}, indent with{" "}
        {indent()}.
      </p>
    </>
  );
}
