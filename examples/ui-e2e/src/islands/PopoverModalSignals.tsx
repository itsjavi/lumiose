import { Popover } from "@lumiose/ui";
import { signal } from "lumiose";

/**
 * A modal popover and a hover popover bound with bind:open (TASK-394). The popovers come after the
 * outputs and the button (TASK-403).
 */
export function PopoverModalSignals() {
  const modal = signal(false);
  const card = signal(false);
  return (
    <section>
      <output data-testid="popover-state">
        modal: {modal() ? "open" : "closed"}, card: {card() ? "open" : "closed"}
      </output>
      <button
        type="button"
        class="lu-button"
        data-testid="open-modal"
        onClick={() => modal.set(true)}
      >
        Open the modal one
      </button>
      <Popover.Root modal bind:open={modal}>
        <Popover.Trigger class="lu-button">Settings</Popover.Trigger>
        <Popover.Popup class="lu-popover" sideOffset={8}>
          <Popover.Title>Settings</Popover.Title>
          <Popover.Close class="lu-button">Done</Popover.Close>
        </Popover.Popup>
      </Popover.Root>
      <Popover.Root bind:open={card}>
        <Popover.Trigger class="lu-button" openOnHover delay={100}>
          Profile card
        </Popover.Trigger>
        <Popover.Popup class="lu-popover" sideOffset={8}>
          <Popover.Description>A card that opens on hover.</Popover.Description>
        </Popover.Popup>
      </Popover.Root>
    </section>
  );
}
