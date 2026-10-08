// Conditionals: a reactive test with a JSX arm compiles to a memoised branch; static tests are
// evaluated once; a component returning a reactive conditional returns a tracked function.
import { signal } from "lumen";

export function Branches(props: { user?: { name: string }; mode: "a" | "b" | "c" }) {
  const open = signal(false);
  const loggedIn = true;
  return (
    <div>
      {open() ? <p>Open</p> : <p>Closed</p>}
      {open() && <span>Visible</span>}
      {props.user ? <b>{props.user.name}</b> : null}
      {props.mode === "a" ? <i>A</i> : props.mode === "b" ? <i>B</i> : <i>C</i>}
      {loggedIn ? <em>Static</em> : <em>Never</em>}
      {open() ? "yes" : "no"}
    </div>
  );
}

export function Switch(props: { on: boolean }) {
  return props.on ? <p>On</p> : <p>Off</p>;
}
