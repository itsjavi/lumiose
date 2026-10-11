import { onMount, signal, Title, type PageProps } from "lumiose";

const TRACKS: Record<string, string> = { "1": "Overworld", "2": "Cave", "3": "Boss" };

// Prerendered for each id (the project default lumiose({ prerender: true })).
export function staticPaths() {
  return Object.keys(TRACKS).map((id) => ({ params: { id } }));
}

// Awaited at build time; hydration replays the recorded value instead of loading it again.
async function load(id: string): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 10));
  return TRACKS[id] ?? "Unknown";
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
