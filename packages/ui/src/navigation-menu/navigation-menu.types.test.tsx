// Navigation Menu's prop types (TASK-380). Type-level: `pnpm typecheck` checks the JSX below and
// its `@ts-expect-error` lines; the runtime part only keeps Vitest happy. Never rendered.
import { signal } from "lumiose";
import { expect, it } from "vitest";
import { NavigationMenu } from "./navigation-menu.tsx";

export function Typed() {
  const open = signal<string | null>(null);
  return (
    <>
      <NavigationMenu.Root aria-label="Main" bind:value={open} delay={0} closeDelay={100}>
        <NavigationMenu.List>
          <NavigationMenu.Item value="a">
            <NavigationMenu.Trigger>
              A <NavigationMenu.Icon />
            </NavigationMenu.Trigger>
            <NavigationMenu.Content side="top" align="start" sideOffset={8}>
              <NavigationMenu.Link href="/a" active closeOnClick>
                A
              </NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
      </NavigationMenu.Root>
      <NavigationMenu.Root
        value={open()}
        onValueChange={(next: string | null) => open.set(next)}
        orientation="vertical"
      />
      {/* @ts-expect-error: bind:value takes a string or null signal */}
      <NavigationMenu.Root bind:value={signal(1)} />
      {/* @ts-expect-error: orientations are horizontal or vertical */}
      <NavigationMenu.Root orientation="diagonal" />
    </>
  );
}

it("is checked by the type checker", () => {
  expect(typeof Typed).toBe("function");
});
