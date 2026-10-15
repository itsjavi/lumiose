// Generated from packages/ui/docs/select.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Select } from "@lumiose/ui";

export function PlanField() {
  return (
    <form method="post">
      <label for="plan">Plan</label>
      <Select.Root id="plan" name="plan" defaultValue="pro" class="lu-select">
        <Select.Trigger>
          <Select.Value />
        </Select.Trigger>
        <Select.Item value="free">Free</Select.Item>
        <Select.Item value="pro">Pro</Select.Item>
        <Select.Separator />
        <Select.Group label="Teams">
          <Select.Item value="team">Team</Select.Item>
          <Select.Item value="enterprise" disabled>
            Enterprise
          </Select.Item>
        </Select.Group>
      </Select.Root>
      <button class="lu-button">Save</button>
    </form>
  );
}
