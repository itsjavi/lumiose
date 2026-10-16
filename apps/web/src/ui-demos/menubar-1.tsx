// Generated from packages/ui/docs/menubar.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Menu, Menubar } from "@lumiose/ui";

export function EditorMenus() {
  return (
    <Menubar aria-label="Editor" class="lu-menubar">
      <Menu.Root>
        <Menu.Trigger>File</Menu.Trigger>
        <Menu.Popup class="lu-menu">
          <Menu.Item>New file</Menu.Item>
          <Menu.Item>Open…</Menu.Item>
          <Menu.SubmenuRoot>
            <Menu.SubmenuTrigger>Share</Menu.SubmenuTrigger>
            <Menu.Popup class="lu-menu">
              <Menu.Item>Email</Menu.Item>
              <Menu.Item>Copy link</Menu.Item>
            </Menu.Popup>
          </Menu.SubmenuRoot>
        </Menu.Popup>
      </Menu.Root>
      <Menu.Root>
        <Menu.Trigger>Edit</Menu.Trigger>
        <Menu.Popup class="lu-menu">
          <Menu.Item>Undo</Menu.Item>
          <Menu.Item>Redo</Menu.Item>
        </Menu.Popup>
      </Menu.Root>
      <Menu.Root>
        <Menu.Trigger>View</Menu.Trigger>
        <Menu.Popup class="lu-menu">
          <Menu.RadioGroup defaultValue="100">
            <Menu.GroupLabel>Zoom</Menu.GroupLabel>
            <Menu.RadioItem value="75">75%</Menu.RadioItem>
            <Menu.RadioItem value="100">100%</Menu.RadioItem>
          </Menu.RadioGroup>
        </Menu.Popup>
      </Menu.Root>
    </Menubar>
  );
}
