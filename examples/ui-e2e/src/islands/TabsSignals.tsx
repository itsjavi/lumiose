import { Tabs } from "@lumiose/ui";
import { signal } from "lumiose";

/** Tabs bound to a signal with bind:value (decision-62, TASK-360), with an indicator (TASK-395). */
export function TabsSignals() {
  const tab = signal("overview");
  const locked = signal(false);
  return (
    <section>
      <Tabs.Root class="lu-tabs" bind:value={tab}>
        <Tabs.List aria-label="Project">
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="activity" disabled={locked()}>
            Activity
          </Tabs.Tab>
          <Tabs.Tab value="settings">Settings</Tabs.Tab>
          <Tabs.Indicator />
        </Tabs.List>
        <Tabs.Panel value="overview">The project at a glance.</Tabs.Panel>
        <Tabs.Panel value="activity">What happened lately.</Tabs.Panel>
        <Tabs.Panel value="settings">Name, visibility and members.</Tabs.Panel>
      </Tabs.Root>
      <button
        type="button"
        class="lu-button"
        data-testid="show-settings"
        onClick={() => tab.set("settings")}
      >
        Show settings
      </button>
      <button
        type="button"
        class="lu-button"
        data-testid="lock-activity"
        onClick={() => locked.update((v) => !v)}
      >
        Lock activity
      </button>
      <output data-testid="tab-state">tab: {tab()}</output>
    </section>
  );
}
