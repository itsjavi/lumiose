// Generated from packages/ui/docs/tabs.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Tabs } from "@lumiose/ui";

export function Release() {
  return (
    <Tabs.Root class="lu-tabs" defaultValue="notes">
      <Tabs.List aria-label="Release">
        <Tabs.Tab value="notes">Notes</Tabs.Tab>
        <Tabs.Tab value="changelog">Full changelog</Tabs.Tab>
        <Tabs.Indicator />
      </Tabs.List>
      <Tabs.Panel value="notes">The highlights.</Tabs.Panel>
      <Tabs.Panel value="changelog">Every change.</Tabs.Panel>
    </Tabs.Root>
  );
}
