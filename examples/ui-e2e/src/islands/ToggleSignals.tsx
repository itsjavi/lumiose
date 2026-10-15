import { Toggle, ToggleGroup } from "@lumiose/ui";
import { signal } from "lumiose";

/**
 * A Toggle bound with bind:pressed and a ToggleGroup with bind:value (TASK-369). The components
 * come last in their sections, after the plain elements (TASK-403).
 */
export function ToggleSignals() {
  const pinned = signal(false);
  const align = signal<string[]>(["left"]);
  return (
    <section class="grid">
      <section>
        <output data-testid="pin-state">pinned: {pinned() ? "yes" : "no"}</output>
        <Toggle bind:pressed={pinned} class="lu-toggle">
          Pin
        </Toggle>
      </section>
      <section>
        <output data-testid="align-state">align: {align().join(", ") || "none"}</output>
        <button
          type="button"
          class="lu-button"
          data-testid="set-signals"
          onClick={() => {
            pinned.set(true);
            align.set(["right"]);
          }}
        >
          Set the signals
        </button>
        <ToggleGroup aria-label="Alignment" bind:value={align} class="lu-toggle-group">
          <Toggle value="left" class="lu-toggle">
            Left
          </Toggle>
          <Toggle value="center" class="lu-toggle">
            Center
          </Toggle>
          <Toggle value="right" class="lu-toggle">
            Right
          </Toggle>
        </ToggleGroup>
      </section>
    </section>
  );
}
