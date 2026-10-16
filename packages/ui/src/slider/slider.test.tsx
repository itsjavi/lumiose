// Server HTML of Slider (TASK-372): native range inputs as thumbs, with their range, step, name and
// label, the value text, and the selected part of the track as `--lu-slider-start` and
// `--lu-slider-end`, for a page without JavaScript.
import { renderToString } from "lumiose";
import { describe, expect, it } from "vitest";
import { Field } from "../field/field.tsx";
import { attrs } from "../test/html.ts";
import { Slider } from "./slider.tsx";

const inputs = (html: string) =>
  [...html.matchAll(/<input\b([^>]*)>/g)].map((m) => attrs(`<input${m[1]}>`, "input"));
const output = (html: string) => html.match(/<output\b[^>]*>([^<]*)</)?.[1];

describe("Slider on the server", () => {
  it("renders one native range input, labelled, with its range and the value text", async () => {
    const html = await renderToString(() => (
      <Slider.Root name="volume" defaultValue={40} min={0} max={200} step={5} largeStep={20}>
        <Slider.Label>Volume</Slider.Label>
        <Slider.Value />
        <Slider.Control>
          <Slider.Track>
            <Slider.Indicator />
          </Slider.Track>
          <Slider.Thumb />
        </Slider.Control>
      </Slider.Root>
    ));
    const root = attrs(html, "lu-slider");
    expect(root).toMatchObject({
      "data-orientation": "horizontal",
      "large-step": "20",
      style: "--lu-slider-start:0%;--lu-slider-end:20%",
    });
    const [thumb] = inputs(html);
    expect(thumb).toEqual({
      "aria-labelledby": `${root.id}-label`,
      type: "range",
      id: `${root.id}-thumb-0`,
      min: "0",
      max: "200",
      step: "5",
      value: "40",
      name: "volume",
    });
    expect(attrs(html, "label")).toMatchObject({ for: thumb!.id });
    // Not a live region: the thumb announces its value once (TASK-439, M31).
    expect(attrs(html, "output")).toMatchObject({ for: thumb!.id, "aria-live": "off" });
    expect(output(html)).toBe("40");
  });

  it("renders a range: a thumb per value, each with its own label and formatted value", async () => {
    const html = await renderToString(() => (
      <Slider.Root
        name="price"
        defaultValue={[20, 60]}
        minStepsBetweenValues={2}
        thumbCollisionBehavior="none"
        format={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }}
        locale="en-US"
      >
        <Slider.Value />
        <Slider.Control>
          <Slider.Track>
            <Slider.Indicator />
          </Slider.Track>
          <Slider.Thumb aria-label="Minimum price" />
          <Slider.Thumb aria-label="Maximum price" />
        </Slider.Control>
      </Slider.Root>
    ));
    const root = attrs(html, "lu-slider");
    expect(root).toMatchObject({
      "min-steps-between-values": "2",
      "thumb-collision-behavior": "none",
      locale: "en-US",
      style: "--lu-slider-start:20%;--lu-slider-end:60%",
    });
    expect(
      inputs(html).map((t) => [t.id, t.value, t.name, t["aria-label"], t["aria-valuetext"]]),
    ).toEqual([
      [`${root.id}-thumb-0`, "20", "price", "Minimum price", "€20"],
      [`${root.id}-thumb-1`, "60", "price", "Maximum price", "€60"],
    ]);
    expect(attrs(html, "output").for).toBe(`${root.id}-thumb-0 ${root.id}-thumb-1`);
    expect(output(html)).toBe("€20 – €60");
  });

  it("groups a range's thumbs under the Label, and writes the thumb alignment", async () => {
    const range = await renderToString(() => (
      <Slider.Root defaultValue={[20, 60]} thumbAlignment="center" thumbCollisionBehavior="swap">
        <Slider.Label>Price</Slider.Label>
        <Slider.Control>
          <Slider.Thumb aria-label="Minimum price" />
          <Slider.Thumb aria-label="Maximum price" />
        </Slider.Control>
      </Slider.Root>
    ));
    const root = attrs(range, "lu-slider");
    expect(root).toMatchObject({
      "data-thumb-alignment": "center",
      "thumb-collision-behavior": "swap",
    });
    expect(attrs(range, "div")).toEqual({ role: "group", "aria-labelledby": `${root.id}-label` });
    // One thumb: no group.
    const single = await renderToString(() => (
      <Slider.Root>
        <Slider.Label>Volume</Slider.Label>
        <Slider.Control>
          <Slider.Thumb />
        </Slider.Control>
      </Slider.Root>
    ));
    expect(attrs(single, "div")).toEqual({});
  });

  it("renders a vertical, disabled slider, and Value content of your own without for", async () => {
    const html = await renderToString(() => (
      <Slider.Root defaultValue={3} max={10} orientation="vertical" disabled>
        <Slider.Value>{(texts) => `Level ${texts[0]}`}</Slider.Value>
        <Slider.Control>
          <Slider.Thumb aria-label="Level" />
        </Slider.Control>
      </Slider.Root>
    ));
    expect(attrs(html, "lu-slider")["data-orientation"]).toBe("vertical");
    expect(inputs(html)[0]).toMatchObject({ disabled: "", "aria-orientation": "vertical" });
    expect(attrs(html, "output")).not.toHaveProperty("for");
    expect(output(html)).toBe("Level 3");
  });

  it("takes the field's id, name and description", async () => {
    const html = await renderToString(() => (
      <Field.Root name="zoom">
        <Field.Label>Zoom</Field.Label>
        <Field.Description>In percent.</Field.Description>
        <Slider.Root defaultValue={100} min={50} max={200}>
          <Slider.Control>
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>
      </Field.Root>
    ));
    const field = attrs(html, "lu-field");
    expect(inputs(html)[0]).toMatchObject({
      id: `${field.id}-control`,
      name: "zoom",
      "aria-describedby": `${field.id}-description`,
    });
  });
});
