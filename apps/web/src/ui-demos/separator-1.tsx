// Generated from packages/ui/docs/separator.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Separator } from "@lumiose/ui";

export function FooterLinks() {
  return (
    <nav aria-label="Footer" style={{ display: "flex", gap: "0.75rem", "align-items": "center" }}>
      <a href="#docs">Docs</a>
      <a href="#blog">Blog</a>
      <Separator orientation="vertical" class="lu-separator" />
      <a href="#privacy">Privacy</a>
      <a href="#terms">Terms</a>
    </nav>
  );
}
