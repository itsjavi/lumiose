import { Combobox } from "@lumiose/ui";
import { signal } from "lumiose";

const COUNTRIES = ["Austria", "Belgium", "Denmark", "France", "Germany", "Portugal", "Spain"];

/**
 * Async options with the Status inside the Popup, as combobox.md's example has it (TASK-438,
 * M22): while the search runs there is no option, and the popup shows the Status.
 */
export function ComboboxStatus() {
  const results = signal<string[]>([]);
  const searching = signal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const search = (text: string) => {
    clearTimeout(timer);
    searching.set(true);
    results.set([]);
    timer = setTimeout(() => {
      const query = text.trim().toLowerCase();
      results.set(query ? COUNTRIES.filter((c) => c.toLowerCase().includes(query)) : []);
      searching.set(false);
    }, 600);
  };
  return (
    <Combobox.Root name="country" filter="none" class="lu-combobox">
      <Combobox.Label>Country</Combobox.Label>
      <Combobox.Input
        onInput={(event) => search((event.currentTarget as HTMLInputElement).value)}
      />
      <Combobox.Popup>
        <Combobox.Status>{searching() ? "Searching…" : ""}</Combobox.Status>
        <Combobox.List>
          {results().map((name) => (
            <Combobox.Item value={name.toLowerCase()}>{name}</Combobox.Item>
          ))}
        </Combobox.List>
      </Combobox.Popup>
    </Combobox.Root>
  );
}
