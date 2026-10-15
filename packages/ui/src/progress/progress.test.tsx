// Server HTML of Progress and Meter (TASK-373): native `<progress>` and `<meter>` with a label,
// the value as text (a percentage by default, or your format), `--lu-value`, and an
// indeterminate progress.
import { renderToString } from "lumiose";
import { describe, expect, it } from "vitest";
import { Meter } from "../meter/meter.tsx";
import { attrs } from "../test/html.ts";
import { Progress } from "./progress.tsx";

const text = (html: string, tag: string) => html.match(new RegExp(`<${tag}\\b[^>]*>([^<]*)<`))?.[1];

describe("Progress on the server", () => {
  it("labels a native progress and writes its value as a percentage", async () => {
    const html = await renderToString(() => (
      <Progress.Root value={30} class="p">
        <Progress.Label>Uploading</Progress.Label>
        <Progress.Value />
        <Progress.Track />
      </Progress.Root>
    ));
    const root = attrs(html, "div");
    expect(root).toMatchObject({ class: "p", style: "--lu-value:30%" });
    const track = attrs(html, "progress");
    expect(track).toMatchObject({ value: "30", max: "100", "aria-valuetext": "30%" });
    expect(attrs(html, "label")).toMatchObject({ for: track.id });
    expect(text(html, "span")).toBe("30%");
  });

  it("counts from min, formats with Intl options, and takes getAriaValueText", async () => {
    const html = await renderToString(() => (
      <Progress.Root
        value={150}
        min={100}
        max={300}
        format={{ style: "unit", unit: "megabyte" }}
        locale="en-US"
        getAriaValueText={(formatted) => `${formatted} of 300 MB`}
      >
        <Progress.Track />
        <Progress.Value>{(formatted, value) => `${formatted} (${value})`}</Progress.Value>
      </Progress.Root>
    ));
    expect(attrs(html, "div").style).toBe("--lu-value:25%");
    expect(attrs(html, "progress")).toMatchObject({
      value: "50",
      max: "200",
      "aria-valuetext": "150 MB of 300 MB",
    });
    expect(text(html, "span")).toBe("150 MB (150)");
  });

  it("is indeterminate with a null value: no value, no text", async () => {
    const html = await renderToString(() => (
      <Progress.Root value={null}>
        <Progress.Track aria-label="Loading" />
        <Progress.Value />
      </Progress.Root>
    ));
    expect(attrs(html, "div")).not.toHaveProperty("style");
    const track = attrs(html, "progress");
    expect(track).not.toHaveProperty("value");
    expect(track).not.toHaveProperty("aria-valuetext");
    expect(text(html, "span")).toBe("");
  });
});

describe("Meter on the server", () => {
  it("labels a native meter with its range, bands and value text", async () => {
    const html = await renderToString(() => (
      <Meter.Root value={0.8} min={0} max={1}>
        <Meter.Label>Storage</Meter.Label>
        <Meter.Value />
        <Meter.Track low={0.5} high={0.75} optimum={0.2} />
      </Meter.Root>
    ));
    expect(attrs(html, "div").style).toBe("--lu-value:80%");
    const track = attrs(html, "meter");
    expect(track).toMatchObject({
      value: "0.8",
      min: "0",
      max: "1",
      low: "0.5",
      high: "0.75",
      optimum: "0.2",
      "aria-valuetext": "80%",
    });
    expect(attrs(html, "label")).toMatchObject({ for: track.id });
    expect(text(html, "span")).toBe("80%");
  });
});
