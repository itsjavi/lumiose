// Generated from packages/ui/docs/select.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Select } from "@lumiose/ui";
import { signal } from "lumiose";

export function ThemePicker() {
  const theme = signal("system");
  return (
    <Select.Root aria-label="Theme" bind:value={theme} class="lu-select">
      <Select.Trigger>
        <Select.Value />
      </Select.Trigger>
      <Select.Item value="light">Light</Select.Item>
      <Select.Item value="dark">Dark</Select.Item>
      <Select.Item value="system">System</Select.Item>
    </Select.Root>
  );
}
