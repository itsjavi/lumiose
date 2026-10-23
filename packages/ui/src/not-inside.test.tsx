// A part rendered outside its Root, and the island case its error points at (TASK-550).
import { renderToString } from "lumiose";
import { describe, expect, it } from "vitest";
import { Combobox } from "./combobox/combobox.tsx";
import { Dialog } from "./dialog/dialog.tsx";

// Exported: an island's component must be, for the browser to import it.
export function Picker(props: { options?: JSX.Element; cities?: string[] }) {
  return (
    <Combobox.Root name="city">
      <Combobox.Input />
      <Combobox.List>
        {props.options}
        {props.cities?.map((city) => (
          <Combobox.Item value={city}>{city}</Combobox.Item>
        ))}
      </Combobox.List>
    </Combobox.Root>
  );
}

describe("a part outside its Root", () => {
  it("says where it must be, and points at an island in between", async () => {
    const error = await renderToString(() => <Dialog.Close />).catch((caught: Error) => caught);
    expect((error as Error).message).toMatch(
      /^Dialog parts must be inside <Dialog\.Root>\. If this part looks inside, check for an island in between: a part passed to an island as a slot/,
    );
  });

  it("throws for parts passed to an island as a slot, which render in the page", async () => {
    const html = renderToString(() => (
      <Picker
        client:idle
        options={["Berlin", "Lisbon"].map((city) => (
          <Combobox.Item value={city}>{city}</Combobox.Item>
        ))}
      />
    ));
    await expect(html).rejects.toThrow(
      "Combobox parts must be inside <Combobox.Root>. If this part looks inside, check for an island",
    );
  });

  it("renders the parts the island renders from its props", async () => {
    const html = await renderToString(() => <Picker client:idle cities={["Berlin", "Lisbon"]} />);
    expect(html).toContain("<!--l:");
    expect(html.match(/role="option"/g)).toHaveLength(2);
  });
});
