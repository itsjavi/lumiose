import { PreviewCard } from "@lumiose/ui";
import { signal } from "lumiose";

/**
 * A Preview Card bound with bind:open (TASK-381). The card is a <div>, so it follows the
 * paragraph the link is in.
 */
export function PreviewCardSignals() {
  const open = signal(false);
  return (
    <section>
      <PreviewCard.Root bind:open={open}>
        <p>
          See the{" "}
          <PreviewCard.Trigger href="#changelog" delay={100}>
            changelog
          </PreviewCard.Trigger>{" "}
          for what changed.
        </p>
        <PreviewCard.Popup class="lu-preview-card">
          <strong>Changelog</strong>
          <p>Every release, newest first.</p>
        </PreviewCard.Popup>
      </PreviewCard.Root>
      <output data-testid="card-state">card: {open() ? "open" : "closed"}</output>
      <button
        type="button"
        class="lu-button"
        data-testid="open-card"
        onClick={() => open.set(true)}
      >
        Open the card
      </button>
    </section>
  );
}
