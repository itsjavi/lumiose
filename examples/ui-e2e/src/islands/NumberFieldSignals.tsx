import { NumberField } from "@lumiose/ui";
import { signal } from "lumiose";

/**
 * A formatted Number Field bound with bind:value, and the commits from onValueCommitted
 * (TASK-375). The field comes after the output and the button (TASK-403).
 */
export function NumberFieldSignals() {
  const amount = signal<number | null>(5);
  const commits = signal(0);
  return (
    <section>
      <output data-testid="number-state">
        amount: {amount() ?? "none"}, commits: {commits()}
      </output>
      <button
        type="button"
        class="lu-button"
        data-testid="set-signals"
        onClick={() => amount.set(42)}
      >
        Set to 42
      </button>
      <NumberField.Root
        id="amount"
        bind:value={amount}
        onValueCommitted={() => commits.set(commits() + 1)}
        min={0}
        max={100}
        format={{ style: "unit", unit: "kilogram" }}
        locale="en-US"
        class="lu-number-field"
      >
        <label for="amount">Weight</label>
        <NumberField.Group>
          <NumberField.Decrement>−</NumberField.Decrement>
          <NumberField.Input />
          <NumberField.Increment>+</NumberField.Increment>
        </NumberField.Group>
      </NumberField.Root>
    </section>
  );
}
