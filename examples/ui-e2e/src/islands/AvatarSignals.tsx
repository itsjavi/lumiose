import { Avatar, Separator, type AvatarLoadingStatus } from "@lumiose/ui";
import { signal } from "lumiose";
import { portrait } from "../portrait.ts";

/**
 * An Avatar whose image breaks and comes back, its loading status in a signal (TASK-374), and a
 * vertical Separator between the buttons. The component comes after the buttons (TASK-403).
 */
export function AvatarSignals() {
  const broken = signal(false);
  const status = signal<AvatarLoadingStatus | "unknown">("unknown");
  return (
    <section>
      <div class="toolbar">
        <button
          type="button"
          class="lu-button"
          data-testid="break"
          onClick={() => broken.set(true)}
        >
          Break the picture
        </button>
        <Separator orientation="vertical" class="lu-separator" />
        <button type="button" class="lu-button" data-testid="fix" onClick={() => broken.set(false)}>
          Fix the picture
        </button>
      </div>
      <p class="named">
        <Avatar.Root class="lu-avatar">
          <Avatar.Image
            src={broken() ? "/avatars/missing.jpg" : portrait}
            alt=""
            onLoadingStatusChange={(next) => status.set(next)}
          />
          <Avatar.Fallback aria-hidden="true">AL</Avatar.Fallback>
        </Avatar.Root>
        Ada Lovelace
      </p>
      <p data-testid="status">Picture: {status()}</p>
    </section>
  );
}
