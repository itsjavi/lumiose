import { signal } from "lumen";
import { params } from "lumen/router";

// A nested layout: it stays mounted while navigating between users.
export default function UsersLayout(props: { children?: JSX.Element }) {
  const count = signal(0);
  return (
    <section>
      <button id="users-count" onClick={() => count.update((n) => n + 1)}>
        users {count()}
      </button>
      <p id="users-param">param {params<"/users/[id]">().id}</p>
      {props.children}
    </section>
  );
}
