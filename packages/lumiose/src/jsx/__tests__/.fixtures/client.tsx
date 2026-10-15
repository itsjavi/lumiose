// `lumiose/env`: `?client` imports (decision-63, TASK-354). The default export is a function called
// while rendering; it takes no arguments and returns nothing.
import "./helpers.ts";
import defineMenu from "./elements/menu.element.ts?client";

export function MenuRoot(props: { children?: JSX.Element }) {
  defineMenu();
  return <div>{props.children}</div>;
}

const result: void = defineMenu();

export const rejected = [
  result,
  // @ts-expect-error It takes no arguments.
  defineMenu("lu-menu"),
  // @ts-expect-error It is not a component.
  <defineMenu />,
];
