import { clientEntry, on, type Handle } from "remix/component";

/** Toggle chips that fill a hidden `labels` input with comma-separated label names (doc-4 §2). */
export const LabelPicker = clientEntry(
  import.meta.url,
  function LabelPicker(handle: Handle<{ names: string[]; defaultValue: string[]; max: number }>) {
    // The initial selection only: later submissions keep the user's choice.
    let selected = handle.props.defaultValue;

    return () => {
      const { names, max } = handle.props;
      return (
        <div class="label-picker" data-testid="label-picker">
          <input type="hidden" name="labels" value={selected.join(",")} />
          {names.map((name) => {
            const pressed = selected.includes(name);
            return (
              <button
                key={name}
                type="button"
                class={`chip label-${name}`}
                aria-pressed={pressed ? "true" : "false"}
                disabled={!pressed && selected.length >= max}
                data-testid="label-chip"
                mix={on("click", () => {
                  selected = pressed ? selected.filter((n) => n !== name) : [...selected, name];
                  handle.update();
                })}
              >
                {name}
              </button>
            );
          })}
        </div>
      );
    };
  },
);
