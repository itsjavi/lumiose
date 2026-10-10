// `lumiose/env`: global JSX, import.meta.env and the Locals hook; custom element augmentation.
import type { Locals } from "lumiose";

declare module "lumiose" {
  interface Locals {
    user?: { id: string };
  }
}

interface XCounter extends HTMLElement {
  count: number;
}

declare module "lumiose/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      "x-counter": JSX.HTMLProps<XCounter> & { count: number };
    }
  }
}

declare global {
  interface ImportMetaEnv {
    readonly PUBLIC_API_URL: string;
  }
}

const element: JSX.Element = <div />;
const css: JSX.CSSProperties = { "font-size": "12px", "--gap": 4 };
const classes: JSX.ClassValue = ["a", { b: true }];
const apiUrl: string = import.meta.env.PUBLIC_API_URL;
const other: string | undefined = import.meta.env.PUBLIC_OTHER;
const dev: boolean = import.meta.env.DEV;
const locals: Locals = { user: { id: "1" } };
const userId: string | undefined = locals.user?.id;

export const accepted = [
  element,
  css,
  classes,
  apiUrl,
  other,
  dev,
  userId,
  <x-counter count={1} ref={(el) => el.count} onClick={(e) => e.currentTarget.count} />,
];

export const rejected = [
  // @ts-expect-error only PUBLIC_* variables are exposed; read secrets with env() on the server.
  import.meta.env.SECRET_KEY,
  // @ts-expect-error Locals members are typed by augmentation.
  locals.missing,
  // @ts-expect-error declared custom elements check their props.
  <x-counter count="1" />,
  // @ts-expect-error global JSX.CSSProperties rejects camelCase keys.
  ((value: JSX.CSSProperties) => value)({ fontSize: "12px" }),
];
