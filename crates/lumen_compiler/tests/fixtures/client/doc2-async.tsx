// Contract doc-2 §5.4 (partially): props destructuring and JSX in an async component.
// The await rewrite and the try/finally `$leave()` wrapper belong to TASK-15.
import { fetchJSON } from "lumen";

export async function Member({ id }: { id: string }) {
  const m = await fetchJSON<{ name: string }>(`/api/members/${id}`);
  return <h3>{m.name}</h3>;
}
