// Async components: only awaits whose nearest function is the component are rewritten (site
// indices in source order); `for await` is lowered; every async component form is tagged.
import { fetchJSON } from "lumiose";

async function load(id: string) {
  return await fetchJSON(`/api/${id}`);
}

export default async function Page(props: { ids: string[] }) {
  const first = await load(props.ids[0]!);
  const later = async () => await load("later");
  let total = 0;
  try {
    total = (await fetchJSON<number>("/api/total")) + 1;
  } catch {
    total = -1;
  }
  return (
    <main>
      <h1>{first.title}</h1>
      <p>{await load("inline")}</p>
      <button onClick={later}>{total}</button>
    </main>
  );
}

export const Stream = async ({ source }: { source: AsyncIterable<string> }) => {
  const lines: string[] = [];
  outer: for await (const line of source) {
    if (line === "") continue outer;
    lines.push(line);
  }
  return <pre>{lines.join("\n")}</pre>;
};

const Quick = async () => <p>{await Promise.resolve("quick")}</p>;

export const Anonymous = async function Anonymous() {
  return <Quick />;
};

export async function Disposing() {
  await using handle = await fetchJSON<AsyncDisposable>("/api/handle");
  return <p>{String(handle)}</p>;
}
