import { signal, type LayoutProps } from "lumiose";
import { params } from "lumiose/router";

// The user pages exist in English and Spanish (`/es/users/1`), with hreflang and canonical links.
export const locales = ["en", "es"];

// A nested layout: it stays mounted while navigating between users.
export default function UsersLayout(props: LayoutProps<"/users">) {
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
