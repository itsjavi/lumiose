// Generated from packages/ui/docs/tabs.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Tabs } from "@lumiose/ui";

export function AccountSettings() {
  return (
    <Tabs.Root class="lu-tabs" defaultValue="account">
      <Tabs.List aria-label="Account settings">
        <Tabs.Tab value="account">Account</Tabs.Tab>
        <Tabs.Tab value="password">Password</Tabs.Tab>
        <Tabs.Tab value="billing" disabled>
          Billing
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="account">Your name and email.</Tabs.Panel>
      <Tabs.Panel value="password">Change your password.</Tabs.Panel>
      <Tabs.Panel value="billing">Invoices and payment methods.</Tabs.Panel>
    </Tabs.Root>
  );
}
