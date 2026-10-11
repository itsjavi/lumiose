import { LABELS_MAX, type Label } from "@bench/data/format";
import { For, createSignal } from "solid-js";

/** Toggle chips that fill a hidden `labels` input with comma-separated label names. */
export function LabelPicker(props: { labels: Label[]; defaultValue: string[] }) {
  // The initial selection only: later submissions keep the user's choice.
  const [selected, setSelected] = createSignal(props.defaultValue);
  const toggle = (name: string) =>
    setSelected((current) =>
      current.includes(name) ? current.filter((n) => n !== name) : [...current, name],
    );
  return (
    <div class="label-picker" data-testid="label-picker">
      <input type="hidden" name="labels" value={selected().join(",")} />
      <For each={props.labels}>
        {(label) => {
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
        }}
      </For>
    </div>
  );
}
