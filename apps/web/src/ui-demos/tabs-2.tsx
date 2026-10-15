// Generated from packages/ui/docs/tabs.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Tabs } from "@lumiose/ui";
import { signal } from "lumiose";

export function Project() {
  const tab = signal("overview");
  return (
    <>
      <Tabs.Root class="lu-tabs" bind:value={tab}>
        <Tabs.List aria-label="Project" activateOnFocus>
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="settings">Settings</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="overview">The project at a glance.</Tabs.Panel>
        <Tabs.Panel value="settings">Name and members.</Tabs.Panel>
      </Tabs.Root>
      <button type="button" onClick={() => tab.set("settings")}>
        Open the settings
      </button>
    </>
  );
}
