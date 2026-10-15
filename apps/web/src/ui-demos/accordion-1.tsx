// Generated from packages/ui/docs/accordion.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Accordion } from "@lumiose/ui";

export function ShippingFaq() {
  return (
    <Accordion.Root class="lu-accordion" defaultValue={["shipping"]}>
      <Accordion.Item value="shipping">
        <Accordion.Header>
          <Accordion.Trigger>When will my order ship?</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel>Within two working days.</Accordion.Panel>
      </Accordion.Item>
      <Accordion.Item value="returns">
        <Accordion.Header>
          <Accordion.Trigger>Can I return it?</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel>Yes, within 30 days, for free.</Accordion.Panel>
      </Accordion.Item>
      <Accordion.Item value="gifts" disabled>
        <Accordion.Header>
          <Accordion.Trigger>Gift cards</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel>Coming soon.</Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  );
}
