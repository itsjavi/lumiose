// Generated from packages/ui/docs/toolbar.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Toggle, ToggleGroup, Toolbar } from "@lumiose/ui";

export function FormattingToolbar() {
  return (
    <Toolbar.Root aria-label="Formatting" class="lu-toolbar">
      <ToggleGroup aria-label="Text style" multiple class="lu-toggle-group">
        <Toggle value="bold" class="lu-toggle">
          Bold
        </Toggle>
        <Toggle value="italic" class="lu-toggle">
          Italic
        </Toggle>
      </ToggleGroup>
      <Toolbar.Separator />
      <Toolbar.Button class="lu-button">Undo</Toolbar.Button>
      <Toolbar.Button class="lu-button" disabled>
        Redo
      </Toolbar.Button>
      <Toolbar.Link href="/help">Help</Toolbar.Link>
    </Toolbar.Root>
  );
}
