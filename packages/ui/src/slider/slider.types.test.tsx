// The prop types of Button, Toggle, ToggleGroup, Progress, Meter and Slider (TASK-364, TASK-369,
// TASK-372, TASK-373). Type-level: `pnpm typecheck` checks the JSX below and its
// `@ts-expect-error` lines; the runtime part only keeps Vitest happy. The JSX is never rendered.
import { signal } from "lumiose";
import { expect, it } from "vitest";
import { Button } from "../button/button.tsx";
import { Meter } from "../meter/meter.tsx";
import { Progress } from "../progress/progress.tsx";
import { Toggle } from "../toggle/toggle.tsx";
import { ToggleGroup } from "../toggle-group/toggle-group.tsx";
import { Slider } from "./slider.tsx";

export function Typed() {
  const on = signal(false);
  const many = signal<string[]>([]);
  const one = signal(50);
  const range = signal([20, 80]);
  return (
    <>
      <Button type="submit" disabled focusableWhenDisabled command="show-modal" commandfor="d">
        Save
      </Button>
      <Toggle bind:pressed={on} value="bold" aria-label="Bold">
        B
      </Toggle>
      <ToggleGroup bind:value={many} multiple orientation="vertical" loopFocus={false}>
        <Toggle value="a">A</Toggle>
      </ToggleGroup>
      <Progress.Root value={null} format={{ style: "percent" }} locale="de-DE">
        <Progress.Track />
        <Progress.Value>{(text, value) => (value === null ? "…" : text)}</Progress.Value>
      </Progress.Root>
      <Meter.Root value={3} max={5} getAriaValueText={(_, value) => `${value} of 5`}>
        <Meter.Track optimum={5} />
      </Meter.Root>
      {/* bind:value infers a number or a number[] (a range). */}
      <Slider.Root bind:value={one} onValueCommitted={(value: number) => value}>
        <Slider.Control>
          <Slider.Thumb />
        </Slider.Control>
      </Slider.Root>
      <Slider.Root
        bind:value={range}
        thumbCollisionBehavior="none"
        onValueCommitted={(value: number[]) => value}
      >
        <Slider.Value>{(texts, values) => `${texts.join("/")} ${values.length}`}</Slider.Value>
      </Slider.Root>
      {/* @ts-expect-error: bind:pressed takes a boolean signal */}
      <Toggle bind:pressed={one} />
      {/* @ts-expect-error: a Toggle is always type="button" */}
      <Toggle type="submit" />
      {/* @ts-expect-error: a ToggleGroup's value is a string[] */}
      <ToggleGroup value="a" />
      {/* @ts-expect-error: a Meter needs its value */}
      <Meter.Root />
      <Slider.Root thumbCollisionBehavior="swap" thumbAlignment="center" defaultValue={[1, 2]} />
      {/* @ts-expect-error: Base UI's edge-client-only is not offered */}
      <Slider.Root thumbAlignment="edge-client-only" />
      {/* @ts-expect-error: a thumb's range is the Root's */}
      <Slider.Thumb max={5} />
    </>
  );
}

it("type-checks (see pnpm typecheck)", () => {
  expect(Typed).toBeTypeOf("function");
});
