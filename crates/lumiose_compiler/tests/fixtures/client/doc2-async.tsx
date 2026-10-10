// Contract doc-2 §5.4: $async tagging, the await rewrite and the try/finally `$leave()` wrapper.
import { fetchJSON } from "lumiose";

export async function Member({ id }: { id: string }) {
  const m = await fetchJSON<{ name: string }>(`/api/members/${id}`);
  return <h3>{m.name}</h3>;
}
