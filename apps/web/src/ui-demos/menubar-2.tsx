// Generated from packages/ui/docs/menubar.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Menu, Menubar } from "@lumiose/ui";
import { signal } from "lumiose";

export function DocumentMenus() {
  const wrap = signal(false);
  const status = signal("Not saved yet");
  return (
    <>
      <Menubar aria-label="Document" class="lu-menubar">
        <Menu.Root>
          <Menu.Trigger>File</Menu.Trigger>
          <Menu.Popup class="lu-menu">
            <Menu.Item onClick={() => status.set("Saved")}>Save</Menu.Item>
          </Menu.Popup>
        </Menu.Root>
        <Menu.Root>
          <Menu.Trigger>Edit</Menu.Trigger>
          <Menu.Popup class="lu-menu">
            <Menu.CheckboxItem bind:checked={wrap}>Word wrap</Menu.CheckboxItem>
          </Menu.Popup>
        </Menu.Root>
      </Menubar>
      <p>
        {status()}; word wrap is {wrap() ? "on" : "off"}
      </p>
    </>
  );
}
