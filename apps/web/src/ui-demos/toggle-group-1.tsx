// Generated from packages/ui/docs/toggle-group.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Toggle } from "@lumiose/ui/toggle";
import { ToggleGroup } from "@lumiose/ui/toggle-group";
import { signal } from "lumiose";

export function TextAlignment() {
  const align = signal<string[]>(["left"]);
  return (
    <p>
      <ToggleGroup aria-label="Text alignment" bind:value={align} class="lu-toggle-group">
        <Toggle value="left" class="lu-toggle">
          Left
        </Toggle>
        <Toggle value="center" class="lu-toggle">
          Center
        </Toggle>
        <Toggle value="right" class="lu-toggle">
          Right
        </Toggle>
      </ToggleGroup>{" "}
      Aligned: {align()[0] ?? "none"}.
    </p>
  );
}
