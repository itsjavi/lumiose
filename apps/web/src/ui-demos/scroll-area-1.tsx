// Generated from packages/ui/docs/scroll-area.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { ScrollArea } from "@lumiose/ui";

const RELEASES = ["1.4.0", "1.3.2", "1.3.1", "1.3.0", "1.2.0", "1.1.0", "1.0.0"];

export function ReleaseList() {
  return (
    <ScrollArea.Root class="lu-scroll-area" style={{ "block-size": "8rem" }}>
      <ScrollArea.Viewport role="region" aria-label="Releases">
        <ScrollArea.Content>
          <ul>
            {RELEASES.map((release) => (
              <li>{release}</li>
            ))}
          </ul>
        </ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar>
        <ScrollArea.Thumb />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  );
}
