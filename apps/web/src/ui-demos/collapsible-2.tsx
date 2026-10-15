// Generated from packages/ui/docs/collapsible.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Collapsible } from "@lumiose/ui";
import { signal } from "lumiose";

export function AdvancedOptions() {
  const open = signal(false);
  return (
    <>
      <Collapsible.Root class="lu-collapsible" bind:open={open}>
        <Collapsible.Trigger>Advanced options</Collapsible.Trigger>
        <Collapsible.Panel>Proxy, timeouts and retries.</Collapsible.Panel>
      </Collapsible.Root>
      <p>{open() ? "Showing the advanced options" : "Advanced options hidden"}</p>
    </>
  );
}
