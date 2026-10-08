// Contract doc-2 §5.4 (partially): props destructuring and JSX in an async component.
// The await rewrite and the try/finally `$leave()` wrapper belong to TASK-15.
import { fetchJSON } from "lumen";
import { ssr, insert } from "lumen/server";
const _s0 = ["<h3>", "</h3>"];
export async function Member(props) {
	const m = await fetchJSON(`/api/members/${props.id}`);
	return ssr(_s0, insert(m.name));
}
