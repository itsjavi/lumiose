import { ScrollArea } from "@lumiose/ui";
import { signal } from "lumiose";

/** A Scroll Area whose content grows from a signal: the scrollbar follows it (TASK-384). */
export function ScrollAreaSignals() {
  const count = signal(3);
  return (
    <section>
      <button
        type="button"
        class="lu-button"
        data-testid="add-items"
        onClick={() => count.set(count() + 20)}
      >
        Add 20 messages
      </button>
      <ScrollArea.Root
        class="lu-scroll-area"
        style={{ "block-size": "10rem", "inline-size": "16rem" }}
      >
        <ScrollArea.Viewport role="region" aria-label="Messages">
          <ScrollArea.Content>
            <ol>
              {Array.from({ length: count() }, (_, i) => (
                <li>Message {i + 1}</li>
              ))}
            </ol>
          </ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar>
          <ScrollArea.Thumb />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </section>
  );
}
