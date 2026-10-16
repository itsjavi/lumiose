import { Slider } from "@lumiose/ui";
import { signal } from "lumiose";

/**
 * A slider and a range slider bound with bind:value, and the committed values from
 * onValueCommitted (TASK-372); a range whose thumbs stop at each other, whose blocked moves report
 * nothing (TASK-449 L21). The sliders come after the outputs and the button (TASK-403).
 */
export function SliderSignals() {
  const volume = signal(40);
  const range = signal([20, 80]);
  const commits = signal(0);
  const changes = signal(0);
  const committed = signal(0);
  return (
    <section>
      <output data-testid="slider-state">
        volume: {volume()}, range: {range().join("–")}, commits: {commits()}
      </output>
      <output data-testid="blocked-state">
        blocked: {changes()} changes, {committed()} commits
      </output>
      <button
        type="button"
        class="lu-button"
        data-testid="set-signals"
        onClick={() => {
          volume.set(75);
          range.set([10, 30]);
        }}
      >
        Set the signals
      </button>
      <Slider.Root bind:value={volume} class="lu-slider">
        <Slider.Label>Volume</Slider.Label>
        <Slider.Value />
        <Slider.Control>
          <Slider.Track>
            <Slider.Indicator />
          </Slider.Track>
          <Slider.Thumb />
        </Slider.Control>
      </Slider.Root>
      <Slider.Root
        bind:value={range}
        onValueCommitted={() => commits.set(commits() + 1)}
        class="lu-slider"
      >
        <Slider.Label>Range</Slider.Label>
        <Slider.Value />
        <Slider.Control>
          <Slider.Track>
            <Slider.Indicator />
          </Slider.Track>
          <Slider.Thumb aria-label="Range start" />
          <Slider.Thumb aria-label="Range end" />
        </Slider.Control>
      </Slider.Root>
      <Slider.Root
        defaultValue={[50, 50]}
        thumbCollisionBehavior="none"
        onValueChange={() => changes.set(changes() + 1)}
        onValueCommitted={() => committed.set(committed() + 1)}
        class="lu-slider"
      >
        <Slider.Label>Blocked</Slider.Label>
        <Slider.Control>
          <Slider.Track>
            <Slider.Indicator />
          </Slider.Track>
          <Slider.Thumb aria-label="Blocked start" />
          <Slider.Thumb aria-label="Blocked end" />
        </Slider.Control>
      </Slider.Root>
    </section>
  );
}
