// Generated from packages/ui/docs/navigation-menu.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { NavigationMenu } from "@lumiose/ui";

export function MainNavigation() {
  return (
    <NavigationMenu.Root aria-label="Main" class="lu-navigation-menu">
      <NavigationMenu.List>
        <NavigationMenu.Item>
          <NavigationMenu.Trigger>
            Products <NavigationMenu.Icon>▾</NavigationMenu.Icon>
          </NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <ul>
              <li>
                <NavigationMenu.Link href="#analytics">Analytics</NavigationMenu.Link>
              </li>
              <li>
                <NavigationMenu.Link href="#automation">Automation</NavigationMenu.Link>
              </li>
            </ul>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item>
          <NavigationMenu.Trigger>
            Learn <NavigationMenu.Icon>▾</NavigationMenu.Icon>
          </NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <ul>
              <li>
                <NavigationMenu.Link href="#guides">Guides</NavigationMenu.Link>
              </li>
              <li>
                <NavigationMenu.Link href="#blog">Blog</NavigationMenu.Link>
              </li>
            </ul>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item>
          <NavigationMenu.Link href="#pricing" active>
            Pricing
          </NavigationMenu.Link>
        </NavigationMenu.Item>
      </NavigationMenu.List>
    </NavigationMenu.Root>
  );
}
