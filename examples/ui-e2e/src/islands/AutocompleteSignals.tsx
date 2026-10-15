import { Autocomplete } from "@lumiose/ui";
import { signal } from "lumiose";

const FRUITS = ["apple", "apricot", "banana", "cherry", "grape", "mango"];

/**
 * An Autocomplete bound with bind:value (TASK-377), whose suggestions the island filters itself
 * (`mode="none"`), as results from a server would be. The component comes after the output and
 * the button (TASK-403).
 */
export function AutocompleteSignals() {
  const query = signal("");
  const matches = () => FRUITS.filter((fruit) => fruit.startsWith(query().toLowerCase()));
  return (
    <section>
      <output data-testid="query-state">query: {query() || "none"}</output>
      <button
        type="button"
        class="lu-button"
        data-testid="set-signals"
        onClick={() => query.set("man")}
      >
        Set the signal
      </button>
      <Autocomplete.Root bind:value={query} mode="none" class="lu-combobox">
        <Autocomplete.Label>Fruit</Autocomplete.Label>
        <Autocomplete.Input />
        <Autocomplete.Popup>
          <Autocomplete.List>
            {matches().map((fruit) => (
              <Autocomplete.Item value={fruit}>{fruit}</Autocomplete.Item>
            ))}
          </Autocomplete.List>
          <Autocomplete.Status>
            {matches().length} {matches().length === 1 ? "match" : "matches"}
          </Autocomplete.Status>
        </Autocomplete.Popup>
      </Autocomplete.Root>
    </section>
  );
}
