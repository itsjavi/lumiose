// Avatar's prop types (TASK-374). Type-level: `pnpm typecheck` checks the JSX below and its
// `@ts-expect-error` lines; the runtime part only keeps Vitest happy. Never rendered.
import { signal } from "lumiose";
import { expect, it } from "vitest";
import { Avatar, type AvatarLoadingStatus } from "./avatar.tsx";

export function Typed() {
  const status = signal<AvatarLoadingStatus>("loading");
  return (
    <>
      <Avatar.Root class="lu-avatar" title="Ada">
        <Avatar.Image
          src="/ada.jpg"
          srcset="/ada@2x.jpg 2x"
          alt="Ada Lovelace"
          loading="lazy"
          onLoadingStatusChange={(next) => status.set(next)}
        />
        <Avatar.Fallback delay={600} aria-hidden="true">
          AL
        </Avatar.Fallback>
      </Avatar.Root>
      {/* @ts-expect-error: the delay is a number of milliseconds */}
      <Avatar.Fallback delay="600ms" />
      {/* @ts-expect-error: the status is loading, loaded or error */}
      <Avatar.Image onLoadingStatusChange={(next: "idle") => next} />
    </>
  );
}

it("is checked by the type checker", () => {
  expect(typeof Typed).toBe("function");
});
