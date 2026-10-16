// Generated from packages/ui/docs/navigation-menu.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { NavigationMenu } from "@lumiose/ui";
import { signal } from "lumiose";

export function SiteNavigation() {
  const open = signal<string | null>(null);
  return (
    <>
      <NavigationMenu.Root aria-label="Site" bind:value={open} class="lu-navigation-menu">
        <NavigationMenu.List>
          <NavigationMenu.Item value="docs">
            <NavigationMenu.Trigger>Docs</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Link href="#start">Getting started</NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
          <NavigationMenu.Item value="community">
            <NavigationMenu.Trigger>Community</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Link href="#forum">Forum</NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
      </NavigationMenu.Root>
      <p>Open: {open() ?? "none"}</p>
    </>
  );
}
