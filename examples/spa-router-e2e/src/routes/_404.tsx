import type { ErrorPageProps } from "lumiose";

export default function NotFound(props: ErrorPageProps) {
  return (
    <h1 id="not-found">
      {props.status} {props.error.message}
    </h1>
  );
}
