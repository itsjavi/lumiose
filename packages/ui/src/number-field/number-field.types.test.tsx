// Number Field's prop types (TASK-375). Type-level: `pnpm typecheck` checks the JSX below and its
// `@ts-expect-error` lines; the runtime part only keeps Vitest happy. The JSX is never rendered.
import { signal } from "lumiose";
import { expect, it } from "vitest";
import { NumberField } from "./number-field.tsx";

export function Typed() {
  const amount = signal<number | null>(null);
  return (
    <>
      <NumberField.Root
        bind:value={amount}
        onValueCommitted={(value: number | null) => value}
        min={0}
        max={10}
        step={0.5}
        largeStep={2}
        format={{ style: "percent" }}
        locale="en-US"
        allowWheelScrub
        allowOutOfRange
        readOnly
      >
        <NumberField.ScrubArea direction="vertical" pixelSensitivity={3} />
        <NumberField.Group>
          <NumberField.Input aria-label="Amount" placeholder="0" />
          <NumberField.Increment aria-label="More" />
        </NumberField.Group>
      </NumberField.Root>
      {/* @ts-expect-error: bind:value takes a number | null signal */}
      <NumberField.Root bind:value={signal("1")} />
      <NumberField.Root smallStep={0.5} snapOnStep />
      {/* @ts-expect-error: smallStep is a number */}
      <NumberField.Root smallStep="0.5" />
      {/* @ts-expect-error: the range belongs to the Root */}
      <NumberField.Input max={3} />
      {/* @ts-expect-error: the input's type follows `format` */}
      <NumberField.Input type="text" />
    </>
  );
}

it("type-checks (see pnpm typecheck)", () => {
  expect(Typed).toBeTypeOf("function");
});
