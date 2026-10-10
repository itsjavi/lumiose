// `lumiose/env`: `.svg` imports (TASK-70). Inline components with SVG props and `title`; `?url` and
// `?raw` are strings.
import "./helpers.ts";
import Icon from "./icons/home.svg";
import Inline from "./icons/home.svg?inline";
import Url from "./icons/home.svg?url";
import raw from "./icons/home.svg?raw";

const href: string = Url;
const text: string = raw;

export const accepted = [
  href,
  text,
  <Icon />,
  <Icon class="icon" width={32} height="2em" fill="red" aria-label="Home" />,
  <Icon title="Home" style={{ color: "red" }} onClick={(e) => e.currentTarget.viewBox} />,
  <Inline ref={(svg) => svg.getBBox()} stroke-width={2} />,
];

export const rejected = [
  // @ts-expect-error `title` is a string.
  <Icon title={1} />,
  // @ts-expect-error SVG props are checked.
  <Icon width={{}} />,
  // @ts-expect-error `?url` is a string, not a component.
  <Url />,
];
