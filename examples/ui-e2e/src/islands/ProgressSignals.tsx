import { Meter, Progress } from "@lumiose/ui";
import { signal } from "lumiose";

/**
 * A Progress and a Meter following one signal (TASK-373): "Advance" adds 25, "Restart" makes the
 * progress indeterminate. The components come after the buttons (TASK-403).
 */
export function ProgressSignals() {
  const done = signal<number | null>(25);
  return (
    <section>
      <button
        type="button"
        class="lu-button"
        data-testid="advance"
        onClick={() => done.set(Math.min(100, (done() ?? 0) + 25))}
      >
        Advance
      </button>
      <button type="button" class="lu-button" data-testid="restart" onClick={() => done.set(null)}>
        Restart
      </button>
      <Progress.Root value={done()} class="lu-progress">
        <Progress.Label>Task</Progress.Label>
        <Progress.Value />
        <Progress.Track />
      </Progress.Root>
      <Meter.Root value={done() ?? 0} class="lu-meter">
        <Meter.Label>Done</Meter.Label>
        <Meter.Value />
        <Meter.Track />
      </Meter.Root>
    </section>
  );
}
