// Generated from packages/ui/docs/avatar.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Avatar, type AvatarLoadingStatus } from "@lumiose/ui";
import { signal } from "lumiose";

const portrait = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
    <rect width="80" height="80" fill="#fde68a"/>
    <circle cx="40" cy="31" r="14" fill="#b45309"/>
    <path d="M12 80a28 28 0 0 1 56 0z" fill="#b45309"/>
  </svg>`,
)}`;

export function ProfilePicture() {
  const broken = signal(false);
  const status = signal<AvatarLoadingStatus>("loading");
  return (
    <>
      <Avatar.Root class="lu-avatar">
        <Avatar.Image
          src={broken() ? "/avatars/missing.jpg" : portrait}
          alt=""
          onLoadingStatusChange={(next) => status.set(next)}
        />
        <Avatar.Fallback aria-hidden="true">AL</Avatar.Fallback>
      </Avatar.Root>
      <p>Ada Lovelace (picture: {status()})</p>
      <button type="button" class="lu-button" onClick={() => broken.set(!broken())}>
        {broken() ? "Fix the picture" : "Break the picture"}
      </button>
    </>
  );
}
