import { notFound, onMount, signal, Title, type PageProps } from "lumiose";

const TRACKS: Record<string, string> = {
  "1": "Overworld",
  "2": "Cave",
  "3": "Boss",
  "4": "Credits",
};

// Prerendered for each id (inherited from the root layout), except the hidden track 4: a static
// host serves 404.html for its URL, and the router renders this page in the browser (TASK-231).
export function staticPaths() {
  return ["1", "2", "3"].map((id) => ({ params: { id } }));
}

// Awaited at build time; hydration replays the recorded value instead of loading it again.
async function load(id: string): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 10));
  // Tracks saved in this browser are unknown on the server (`lumiose dev` renders the not-found page for
  // them), and render once the router renders this page in the browser.
  const saved = typeof localStorage === "undefined" ? null : localStorage.getItem(`track:${id}`);
  return TRACKS[id] ?? saved ?? notFound();
}

export default async function Track(props: PageProps<"/tracks/[id]">) {
  const name = await load(props.params.id);
  // Browser-only code runs after hydration, never while the build prerenders the page.
  const where = signal("prerendered");
  onMount(() => where.set(`mounted, volume ${localStorage.getItem("volume") ?? "100"}`));
  return (
    <article>
      <Title>{name}</Title>
      <h1 id="track">
        Track {props.params.id}: {name}
      </h1>
      <p id="where">{where()}</p>
    </article>
  );
}
