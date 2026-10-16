// Generated from packages/ui/docs/avatar.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Avatar } from "@lumiose/ui";

// A portrait drawn inline, so the example runs anywhere.
const portrait = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
    <rect width="80" height="80" fill="#c7d2fe"/>
    <circle cx="40" cy="31" r="14" fill="#4338ca"/>
    <path d="M12 80a28 28 0 0 1 56 0z" fill="#4338ca"/>
  </svg>`,
)}`;

export function Reviewers() {
  return (
    <ul aria-label="Reviewers" style={{ display: "flex", gap: "0.5rem", "list-style": "none" }}>
      <li>
        <Avatar.Root class="lu-avatar">
          <Avatar.Image src={portrait} alt="Ada Lovelace" />
          <Avatar.Fallback role="img" aria-label="Ada Lovelace" delay={600}>
            AL
          </Avatar.Fallback>
        </Avatar.Root>
      </li>
      <li>
        <Avatar.Root class="lu-avatar">
          <Avatar.Image src="/avatars/missing.jpg" alt="Grace Hopper" />
          <Avatar.Fallback role="img" aria-label="Grace Hopper">
            GH
          </Avatar.Fallback>
        </Avatar.Root>
      </li>
    </ul>
  );
}
