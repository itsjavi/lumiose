// Island: toggle chips that fill the hidden `labels` input of the new-issue form with
// comma-separated label names (at most LABELS_MAX).
import { LABELS_MAX, type Label } from "@bench/data/format";
import { onMount, signal } from "lumiose";
import { markReady } from "../lib/ready.ts";

export function LabelPicker(props: { labels: Label[]; value: string[] }) {
  const selected = signal(props.value);
  onMount(markReady);

  const toggle = (name: string) =>
    selected.update((current) =>
      current.includes(name) ? current.filter((n) => n !== name) : [...current, name],
    );

  return (
    <div class="label-picker" data-testid="label-picker">
      <input type="hidden" name="labels" value={selected().join(",")} />
      {props.labels.map((label) => {
        const on = () => selected().includes(label.name);
        return (
          <button
            type="button"
            class={`chip label-${label.name}`}
            aria-pressed={on() ? "true" : "false"}
            disabled={!on() && selected().length >= LABELS_MAX}
            onClick={() => toggle(label.name)}
            data-testid="label-chip"
          >
            {label.name}
          </button>
        );
      })}
    </div>
  );
}
