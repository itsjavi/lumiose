// Menubar's prop types (TASK-379). Type-level: `pnpm typecheck` checks the JSX below and its
// `@ts-expect-error` lines; the runtime part only keeps Vitest happy. Never rendered.
import { expect, it } from "vitest";
import { Menu } from "../menu/menu.tsx";
import { Menubar } from "./menubar.tsx";

export function Typed() {
  return (
    <>
      <Menubar aria-label="Editor" orientation="vertical" loopFocus={false} class="lu-menubar">
        <Menu.Root>
          <Menu.Trigger>File</Menu.Trigger>
          <Menu.Popup>
            <Menu.Item>New</Menu.Item>
          </Menu.Popup>
        </Menu.Root>
      </Menubar>
      {/* @ts-expect-error: orientations are horizontal or vertical */}
      <Menubar orientation="diagonal" />
      {/* @ts-expect-error: loopFocus is a boolean */}
      <Menubar loopFocus="no" />
    </>
  );
}

it("is checked by the type checker", () => {
  expect(typeof Typed).toBe("function");
});
