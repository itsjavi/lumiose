import { Toggle, ToggleGroup, Toolbar } from "@lumiose/ui";
import { signal } from "lumiose";

/** A Toolbar whose toggle group and button drive signals (TASK-383). */
export function ToolbarSignals() {
  const align = signal<string[]>(["left"]);
  const saved = signal(0);
  const busy = signal(false);
  return (
    <section>
      <Toolbar.Root aria-label="Editor" class="lu-toolbar">
        <ToggleGroup aria-label="Alignment" bind:value={align} class="lu-toggle-group">
          <Toggle value="left" class="lu-toggle">
            Left
          </Toggle>
          <Toggle value="right" class="lu-toggle">
            Right
          </Toggle>
        </ToggleGroup>
        <Toolbar.Separator />
        <Toolbar.Button
          class="lu-button"
          disabled={busy()}
          onClick={() => {
            saved.set(saved() + 1);
            busy.set(true);
          }}
        >
          Save
        </Toolbar.Button>
        <Toolbar.Button class="lu-button" data-testid="done" onClick={() => busy.set(false)}>
          Done
        </Toolbar.Button>
      </Toolbar.Root>
      <output data-testid="toolbar-state">
        align: {align().join(", ") || "none"}, saves: {saved()}
      </output>
    </section>
  );
}
