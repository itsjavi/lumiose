import { data } from "react-router";

/** Thrown from loaders: renders the root error boundary's 404 page. */
export function notFound(): never {
  throw data("Not Found", { status: 404 });
}

/** A positive integer route param, or a 404. */
export function idParam(value: string | undefined): number {
  if (!value || !/^\d+$/.test(value)) notFound();
  return Number(value);
}
