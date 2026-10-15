// Generated from packages/ui/docs/progress.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Progress } from "@lumiose/ui";
import { signal } from "lumiose";

export function UploadProgress() {
  const done = signal<number | null>(null);
  return (
    <p>
      <button
        type="button"
        class="lu-button"
        onClick={() => done.set(Math.min(100, (done() ?? 0) + 20))}
      >
        Upload a part
      </button>
      <Progress.Root value={done()} class="lu-progress">
        <Progress.Label>Uploading</Progress.Label>
        <Progress.Value />
        <Progress.Track />
      </Progress.Root>
    </p>
  );
}
