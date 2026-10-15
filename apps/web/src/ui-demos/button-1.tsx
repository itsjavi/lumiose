// Generated from packages/ui/docs/button.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Button } from "@lumiose/ui";
import { signal } from "lumiose";

export function SavingButton() {
  const saving = signal(false);
  return (
    <Button
      class="lu-button"
      data-variant="primary"
      disabled={saving()}
      focusableWhenDisabled
      onClick={() => {
        saving.set(true);
        setTimeout(() => saving.set(false), 1500);
      }}
    >
      {saving() ? "Saving…" : "Save"}
    </Button>
  );
}
