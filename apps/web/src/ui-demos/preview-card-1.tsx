// Generated from packages/ui/docs/preview-card.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { PreviewCard } from "@lumiose/ui";

export function SignalsLink() {
  return (
    <PreviewCard.Root>
      <p>
        Lumiose components update through{" "}
        <PreviewCard.Trigger href="/docs/concepts/signals">signals</PreviewCard.Trigger>.
      </p>
      <PreviewCard.Popup class="lu-preview-card">
        <strong>Signals</strong>
        <p>Values that update whatever reads them.</p>
      </PreviewCard.Popup>
    </PreviewCard.Root>
  );
}
