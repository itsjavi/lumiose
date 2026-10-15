// Generated from packages/ui/docs/accordion.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Accordion } from "@lumiose/ui";
import { signal } from "lumiose";

export function SettingsSections() {
  const open = signal(["profile"]);
  return (
    <>
      <Accordion.Root class="lu-accordion" multiple bind:value={open}>
        <Accordion.Item value="profile">
          <Accordion.Header>
            <Accordion.Trigger>Profile</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>Your name and photo.</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="security">
          <Accordion.Header>
            <Accordion.Trigger>Security</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>Password and recovery keys.</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
      <p>Open: {open().join(", ") || "none"}</p>
    </>
  );
}
