"use client";

import { LABELS_MAX, type Label } from "@bench/data/format";
import { useState } from "react";

/** Toggle chips that fill a hidden `labels` input with comma-separated label names. */
export function LabelPicker({ labels, defaultValue }: { labels: Label[]; defaultValue: string[] }) {
  const [selected, setSelected] = useState(defaultValue);
  const toggle = (name: string) =>
    setSelected((current) =>
      current.includes(name) ? current.filter((n) => n !== name) : [...current, name],
    );
  return (
    <div className="label-picker" data-testid="label-picker">
      <input type="hidden" name="labels" value={selected.join(",")} />
      {labels.map((label) => {
        const on = selected.includes(label.name);
        return (
          <button
            key={label.id}
            type="button"
            className={`chip label-${label.name}`}
            aria-pressed={on}
            disabled={!on && selected.length >= LABELS_MAX}
            onClick={() => toggle(label.name)}
            data-testid="label-option"
            data-label={label.name}
          >
            {label.name}
          </button>
        );
      })}
    </div>
  );
}
