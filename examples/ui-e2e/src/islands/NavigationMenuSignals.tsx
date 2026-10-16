import { NavigationMenu } from "@lumiose/ui";
import { signal } from "lumiose";

/**
 * A navigation menu in an island (TASK-380): the open item bound to a signal, buttons that open and
 * close it, and the value in a status line. The menu comes after the buttons (TASK-403).
 */
export function NavigationMenuSignals() {
  const open = signal<string | null>(null);
  return (
    <section>
      <button
        type="button"
        class="lu-button"
        data-testid="open-docs"
        onClick={() => open.set("docs")}
      >
        Open Docs
      </button>
      <button type="button" class="lu-button" data-testid="close" onClick={() => open.set(null)}>
        Close
      </button>
      <NavigationMenu.Root aria-label="Site" bind:value={open} class="lu-navigation-menu">
        <NavigationMenu.List>
          <NavigationMenu.Item value="docs">
            <NavigationMenu.Trigger>Docs</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <ul>
                <li>
                  <NavigationMenu.Link href="#start">Getting started</NavigationMenu.Link>
                </li>
              </ul>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
          <NavigationMenu.Item value="community">
            <NavigationMenu.Trigger>Community</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <ul>
                <li>
                  <NavigationMenu.Link href="#forum">Forum</NavigationMenu.Link>
                </li>
              </ul>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
      </NavigationMenu.Root>
      <p data-testid="value">Open: {open() ?? "none"}</p>
    </section>
  );
}
