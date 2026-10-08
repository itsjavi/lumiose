import { signal } from "lumen";
import { Link, navigating, url } from "lumen/router";

// The persistent root layout: its counter keeps its value across client navigations.
export default function Layout(props: { children?: JSX.Element }) {
  const count = signal(0);
  return (
    <div>
      <nav>
        <Link href="/">Home</Link>
        <Link href="/users/1">User 1</Link>
        <Link href="/users/2">User 2</Link>
        <Link href="/users/3">User 3 (slow)</Link>
        <Link href="/slow">Suspense</Link>
        <Link href="/search?q=a" prefetch="none">
          Search
        </Link>
        <Link href="/long">Long</Link>
        <Link href="/missing">Missing</Link>
        <Link href="/csr">Client-rendered</Link>
        <a href="/static">Static page</a>
      </nav>
      <button id="root-count" onClick={() => count.update((n) => n + 1)}>
        root {count()}
      </button>
      <p id="status">{navigating() ? "navigating" : "idle"}</p>
      <p id="url">{url().pathname}</p>
      <main>{props.children}</main>
    </div>
  );
}
