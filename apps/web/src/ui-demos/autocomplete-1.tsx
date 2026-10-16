// Generated from packages/ui/docs/autocomplete.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Autocomplete } from "@lumiose/ui";
import { signal } from "lumiose";

const TOPICS = ["accessibility", "animation", "forms", "islands", "routing", "signals"];

export function TopicSearch() {
  const query = signal("");
  return (
    <>
      <Autocomplete.Root name="q" bind:value={query} class="lu-combobox">
        <Autocomplete.Label>Search the docs</Autocomplete.Label>
        <Autocomplete.Input placeholder="Any topic" />
        <Autocomplete.Popup>
          <Autocomplete.List>
            {TOPICS.map((topic) => (
              <Autocomplete.Item value={topic}>{topic}</Autocomplete.Item>
            ))}
          </Autocomplete.List>
          <Autocomplete.Empty>No suggestions: press Enter to search.</Autocomplete.Empty>
        </Autocomplete.Popup>
      </Autocomplete.Root>
      <p>{query() ? `Searching for “${query()}”` : "Type to search."}</p>
    </>
  );
}
