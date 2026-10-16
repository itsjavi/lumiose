import { OTPField } from "@lumiose/ui";
import { signal } from "lumiose";

/** An OTP Field bound with bind:value, with its completion and rejected input (TASK-376). */
export function OTPFieldSignals() {
  const code = signal("");
  const done = signal("");
  const rejected = signal("");
  return (
    <section>
      <OTPField.Root
        id="code"
        length={4}
        bind:value={code}
        onValueComplete={(value) => done.set(value)}
        onValueInvalid={(value) => rejected.set(value)}
        class="lu-otp-field"
      >
        <OTPField.Input aria-label="Code" />
        <OTPField.Slot />
        <OTPField.Slot />
        <OTPField.Slot />
        <OTPField.Slot />
      </OTPField.Root>
      <output data-testid="otp-state">
        code: {code() || "none"}, complete: {done() || "no"}, rejected: {rejected() || "none"}
      </output>
      <button
        type="button"
        class="lu-button"
        data-testid="set-signals"
        onClick={() => code.set("4242")}
      >
        Set 4242
      </button>
    </section>
  );
}
