import { notFound } from "../lib/not-found.server";

// Catch-all route: every unknown URL renders the root error boundary's 404 page inside the layout.
export function loader(): never {
  notFound();
}

export default function NotFoundRoute() {
  return null;
}
