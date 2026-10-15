import { onMount, signal, type LayoutProps } from "lumiose";
import { Link, url } from "lumiose/router";

// Every page below this layout is prerendered at build time (TASK-229).
export const prerender = true;

// The persistent root layout: its counter keeps its value across client navigations.
export default function Layout(props: LayoutProps<"/">) {
  const count = signal(0);
  // Whether src/instrumentation.client.ts had run when the SPA mounted (TASK-295).
  onMount(() => {
    const state = window as unknown as { clientEntry?: { ran: boolean }; entryFirst?: boolean };
    state.entryFirst = state.clientEntry?.ran === true;
  });
  return (
    <div>
      <nav>
        <Link href="/">Home</Link>
        <Link href="/tracks/1">Track 1</Link>
        <Link href="/tracks/2">Track 2</Link>
        <Link href="/tracks/3">Track 3</Link>
        <Link href="/missing">Missing</Link>
      </nav>
      <button id="root-count" onClick={() => count.update((n) => n + 1)}>
        root {count()}
      </button>
      <p id="url">{url().pathname}</p>
      <main>{props.children}</main>
    </div>
  );
}
