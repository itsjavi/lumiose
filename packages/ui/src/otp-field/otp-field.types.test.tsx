// OTP Field's prop types (TASK-376). Type-level: `pnpm typecheck` checks the JSX below and its
// `@ts-expect-error` lines; the runtime part only keeps Vitest happy. The JSX is never rendered.
import { signal } from "lumiose";
import { expect, it } from "vitest";
import { OTPField } from "./otp-field.tsx";

export function Typed() {
  const code = signal("");
  return (
    <>
      <OTPField.Root
        length={6}
        bind:value={code}
        onValueComplete={(value: string) => value}
        onValueInvalid={(value: string) => value}
        validationType="alphanumeric"
        inputMode="text"
        mask
        autoSubmit
      >
        <OTPField.Input aria-label="Code" placeholder="000000" />
        <OTPField.Slot class="slot" />
        <OTPField.Separator orientation="vertical" />
      </OTPField.Root>
      {/* @ts-expect-error: a code has a length */}
      <OTPField.Root />
      {/* @ts-expect-error: one of the validation types */}
      <OTPField.Root length={4} validationType="hex" />
      {/* @ts-expect-error: the input's length is the Root's */}
      <OTPField.Input maxlength={4} />
    </>
  );
}

it("type-checks (see pnpm typecheck)", () => {
  expect(Typed).toBeTypeOf("function");
});
