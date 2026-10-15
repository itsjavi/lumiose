// Generated from packages/ui/docs/combobox.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Combobox } from "@lumiose/ui";

const CITIES = [
  { value: "ber", label: "Berlin" },
  { value: "lis", label: "Lisbon" },
  { value: "mad", label: "Madrid" },
];

export function CityField() {
  return (
    <form method="post">
      <Combobox.Root name="city" defaultValue="lis" required class="lu-combobox">
        <Combobox.Label>City</Combobox.Label>
        <Combobox.Input placeholder="Search cities" />
        <Combobox.Clear aria-label="Clear city" />
        <Combobox.Trigger aria-label="Show cities" />
        <Combobox.Popup>
          <Combobox.List>
            {CITIES.map((city) => (
              <Combobox.Item value={city.value}>{city.label}</Combobox.Item>
            ))}
          </Combobox.List>
          <Combobox.Empty>No city matches.</Combobox.Empty>
        </Combobox.Popup>
      </Combobox.Root>
      <button class="lu-button">Save</button>
    </form>
  );
}
