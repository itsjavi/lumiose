import { Select } from "@lumiose/ui";
import { signal } from "lumiose";

/** Select bound to a signal with bind:value (decision-62, TASK-360). */
export function SelectSignals() {
  const plan = signal("pro");
  return (
    <section>
      <label for="plan">Plan</label>
      <Select.Root id="plan" name="plan" bind:value={plan} class="lu-select">
        <Select.Trigger>
          <Select.Value />
        </Select.Trigger>
        <Select.Item value="free">Free</Select.Item>
        <Select.Item value="pro">Pro</Select.Item>
        <Select.Item value="team">Team</Select.Item>
      </Select.Root>
      <button
        type="button"
        class="lu-button"
        data-testid="pick-team"
        onClick={() => plan.set("team")}
      >
        Pick Team
      </button>
      <output data-testid="select-state">plan: {plan()}</output>
    </section>
  );
}
