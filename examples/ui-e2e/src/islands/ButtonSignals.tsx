import { Button } from "@lumiose/ui";
import { signal } from "lumiose";

/**
 * A save button that stays focusable while it saves (TASK-364): `disabled` with
 * `focusableWhenDisabled`, so focus stays on it and its clicks do nothing until "Finish" is
 * pressed. The buttons come after the output (TASK-403).
 */
export function ButtonSignals() {
  const saving = signal(false);
  const saves = signal(0);
  return (
    <section>
      <output data-testid="button-state">
        saves: {saves()}, {saving() ? "saving" : "idle"}
      </output>
      <Button
        class="lu-button"
        data-variant="primary"
        disabled={saving()}
        focusableWhenDisabled
        onClick={() => {
          saves.set(saves() + 1);
          saving.set(true);
        }}
      >
        {saving() ? "Saving…" : "Save"}
      </Button>
      <Button class="lu-button" data-testid="finish" onClick={() => saving.set(false)}>
        Finish
      </Button>
    </section>
  );
}
