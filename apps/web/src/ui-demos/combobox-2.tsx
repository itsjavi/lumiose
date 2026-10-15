// Generated from packages/ui/docs/combobox.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Combobox } from "@lumiose/ui";
import { signal } from "lumiose";

const TAGS = ["accessibility", "bug", "docs", "performance", "security", "ui"];

/** Stands in for a request to your API: the tags that contain `text`, a moment later. */
function searchTags(text: string): Promise<string[]> {
  const query = text.trim().toLowerCase();
  const found = query ? TAGS.filter((tag) => tag.includes(query)) : [];
  return new Promise((resolve) => setTimeout(() => resolve(found), 200));
}

export function TagPicker() {
  const tags = signal<string[]>([]);
  const results = signal<string[]>([]);
  const searching = signal(false);
  const search = async (text: string) => {
    searching.set(true);
    results.set(await searchTags(text));
    searching.set(false);
  };
  return (
    <Combobox.Root multiple name="tags" filter="none" bind:value={tags} class="lu-combobox">
      <Combobox.Label>Tags</Combobox.Label>
      <Combobox.Chips />
      <Combobox.Input
        onInput={(event) => search((event.currentTarget as HTMLInputElement).value)}
      />
      <Combobox.Popup>
        <Combobox.List>
          {results().map((tag) => (
            <Combobox.Item value={tag}>{tag}</Combobox.Item>
          ))}
        </Combobox.List>
        <Combobox.Status>{searching() ? "Searching…" : ""}</Combobox.Status>
      </Combobox.Popup>
    </Combobox.Root>
  );
}
