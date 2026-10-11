import { useState } from "preact/hooks";

/** Toggle chips that fill a hidden `labels` input with comma-separated label names (a Preact island). */
export default function LabelPicker({
  names,
  defaultValue,
  max,
}: {
  names: string[];
  defaultValue: string[];
  max: number;
}) {
  const [selected, setSelected] = useState(defaultValue);
  const toggle = (name: string) =>
    setSelected((current) =>
      current.includes(name) ? current.filter((n) => n !== name) : [...current, name],
    );
  return (
    <div class="label-picker" data-testid="label-picker">
      <input type="hidden" name="labels" value={selected.join(",")} />
      {names.map((name) => {
        const on = selected.includes(name);
        return (
          <button
            key={name}
            type="button"
            class={`chip label-${name}`}
            aria-pressed={on}
            disabled={!on && selected.length >= max}
            onClick={() => toggle(name)}
            data-testid="label-chip"
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}
