import type { ButtonHTMLAttributes } from "react";

/** A plain React component: it forwards `className`, so a parent's scoped styles reach it. */
export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} />;
}
