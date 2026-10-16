// Generated from packages/ui/docs/otp-field.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { OTPField } from "@lumiose/ui";
import { signal } from "lumiose";

export function VerifyCode() {
  const code = signal("");
  return (
    <form method="post">
      <label for="code">Verification code</label>
      <OTPField.Root
        id="code"
        name="code"
        length={6}
        required
        bind:value={code}
        class="lu-otp-field"
      >
        <OTPField.Input />
        <OTPField.Slot />
        <OTPField.Slot />
        <OTPField.Slot />
        <OTPField.Separator />
        <OTPField.Slot />
        <OTPField.Slot />
        <OTPField.Slot />
      </OTPField.Root>
      <button type="submit" class="lu-button" disabled={code().length < 6}>
        Verify
      </button>
    </form>
  );
}
