// @vitest-environment happy-dom
// Toast in the browser build: a toast added from a payload as it arrived passes only the
// allowlisted `actionProps` to its action button (TASK-470).
import { render } from "lumiose/dom";
import { afterEach, expect, it } from "vitest";
import { Toast } from "./toast.tsx";

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  document.body.innerHTML = "";
});

it("drops actionProps keys outside the allowlist, innerHTML among them", () => {
  const clicks: string[] = [];
  const actionProps = {
    ...JSON.parse(
      '{"children":"Undo","class":"lu-button","aria-label":"Undo the move","type":"submit",' +
        '"formaction":"/delete","style":"position:fixed","id":"pwn","innerHTML":"<img src=x id=img>"}',
    ),
    onClick: () => clicks.push("undo"),
  };
  const container = document.body.appendChild(document.createElement("div"));
  dispose = render(
    () => (
      <Toast.Root toast={{ title: "Moved", actionProps }}>
        <Toast.Action />
      </Toast.Root>
    ),
    container,
  );
  const button = container.querySelector("button")!;
  expect(button.getAttributeNames().sort()).toEqual(["aria-label", "class", "type"]);
  expect(button.type).toBe("button");
  expect(button.innerHTML).toBe("Undo");
  expect(container.querySelector("#img")).toBeNull();
  button.click();
  expect(clicks).toEqual(["undo"]);
});
