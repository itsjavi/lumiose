// Generated from packages/ui/docs/menu.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Menu } from "@lumiose/ui";

export function ProjectMenu() {
  return (
    <Menu.Root>
      <Menu.Trigger class="lu-button">Project</Menu.Trigger>
      <Menu.Popup class="lu-menu">
        <Menu.LinkItem href="/settings">Settings</Menu.LinkItem>
        <Menu.LinkItem href="/members">Members</Menu.LinkItem>
        <Menu.Separator />
        <Menu.SubmenuRoot>
          <Menu.SubmenuTrigger>Export</Menu.SubmenuTrigger>
          <Menu.Popup class="lu-menu">
            <Menu.LinkItem href="/export.csv" download>
              CSV
            </Menu.LinkItem>
            <Menu.LinkItem href="/export.json" download>
              JSON
            </Menu.LinkItem>
          </Menu.Popup>
        </Menu.SubmenuRoot>
      </Menu.Popup>
    </Menu.Root>
  );
}
