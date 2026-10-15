// Generated from packages/ui/docs/collapsible.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Collapsible } from "@lumiose/ui";

export function RecoveryKeys() {
  return (
    <Collapsible.Root class="lu-collapsible">
      <Collapsible.Trigger>Recovery keys</Collapsible.Trigger>
      <Collapsible.Panel>
        <p>Store these keys somewhere safe: each one lets you back in once.</p>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
