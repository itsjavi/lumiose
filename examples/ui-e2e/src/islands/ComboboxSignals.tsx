import { Combobox } from "@lumiose/ui";
import { signal } from "lumiose";

const FRUITS = ["Apple", "Banana", "Cherry", "Pear", "Plum"];
const COLOURS = ["Red", "Green", "Blue", "Yellow"];
const COUNTRIES = ["Austria", "Belgium", "Denmark", "France", "Germany", "Portugal", "Spain"];

/**
 * Combobox bound to signals: `bind:value` and `bind:open` on a single combobox, `bind:value` with
 * `multiple`, and async options: `filter="none"` with the island filtering after a delay, as a
 * search request would, and a status that says so.
 */
export function ComboboxSignals() {
  const fruit = signal("pear");
  const open = signal(false);
  const colours = signal<string[]>(["red"]);
  const results = signal<string[]>([]);
  const searching = signal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const search = (text: string) => {
    clearTimeout(timer);
    searching.set(true);
    timer = setTimeout(() => {
      const query = text.trim().toLowerCase();
      results.set(query ? COUNTRIES.filter((c) => c.toLowerCase().includes(query)) : []);
      searching.set(false);
    }, 150);
  };
  return (
    <section class="grid">
      <div>
        <Combobox.Root name="fruit" bind:value={fruit} bind:open={open} class="lu-combobox">
          <Combobox.Label>Fruit</Combobox.Label>
          <Combobox.Input />
          <Combobox.Trigger aria-label="Show fruits" />
          <Combobox.List>
            {FRUITS.map((name) => (
              <Combobox.Item value={name.toLowerCase()}>{name}</Combobox.Item>
            ))}
          </Combobox.List>
        </Combobox.Root>
        <button
          type="button"
          class="lu-button"
          data-testid="pick-plum"
          onClick={() => fruit.set("plum")}
        >
          Pick plum
        </button>
        <button
          type="button"
          class="lu-button"
          data-testid="open-by-signal"
          onClick={() => open.set(true)}
        >
          Open fruits
        </button>
      </div>

      <Combobox.Root multiple name="colours" bind:value={colours} class="lu-combobox">
        <Combobox.Label>Colours</Combobox.Label>
        <Combobox.Chips />
        <Combobox.Input />
        <Combobox.List>
          {COLOURS.map((name) => (
            <Combobox.Item value={name.toLowerCase()}>{name}</Combobox.Item>
          ))}
        </Combobox.List>
      </Combobox.Root>

      <Combobox.Root name="country" filter="none" class="lu-combobox">
        <Combobox.Label>Country</Combobox.Label>
        <Combobox.Input
          placeholder="Type to search"
          onInput={(event) => search((event.currentTarget as HTMLInputElement).value)}
        />
        <Combobox.Status>{searching() ? "Searching…" : ""}</Combobox.Status>
        <Combobox.List>
          {results().map((name) => (
            <Combobox.Item value={name.toLowerCase()}>{name}</Combobox.Item>
          ))}
        </Combobox.List>
      </Combobox.Root>

      <output data-testid="combobox-state">
        fruit: {fruit()}, open: {String(open())}, colours: {colours().join(" ") || "none"}
      </output>
    </section>
  );
}
