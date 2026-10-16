// Toolbar's prop types (TASK-383). Type-level: `pnpm typecheck` checks the JSX below and its
// `@ts-expect-error` lines; the runtime part only keeps Vitest happy. The JSX is never rendered.
import { expect, it } from "vitest";
import { Toolbar } from "./toolbar.tsx";

export function Typed() {
  return (
    <>
      <Toolbar.Root aria-label="Tools" orientation="vertical" loopFocus={false} disabled>
        <Toolbar.Button onClick={() => {}} focusableWhenDisabled={false}>
          A
        </Toolbar.Button>
        <Toolbar.Link href="/a">B</Toolbar.Link>
        <Toolbar.Input type="search" focusableWhenDisabled />
        <Toolbar.Group disabled>
          <Toolbar.Button>C</Toolbar.Button>
        </Toolbar.Group>
        <Toolbar.Separator orientation="horizontal" />
      </Toolbar.Root>
      {/* @ts-expect-error: horizontal or vertical */}
      <Toolbar.Root orientation="diagonal" />
      {/* @ts-expect-error: loopFocus is a boolean */}
      <Toolbar.Root loopFocus="no" />
    </>
  );
}

it("type-checks (see pnpm typecheck)", () => {
  expect(Typed).toBeTypeOf("function");
});
