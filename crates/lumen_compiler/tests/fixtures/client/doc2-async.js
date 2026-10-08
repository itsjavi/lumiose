// Contract doc-2 §5.4 (partially): props destructuring and JSX in an async component.
// The await rewrite and the try/finally `$leave()` wrapper belong to TASK-15.
import { fetchJSON } from "lumen";
import { template, insert } from "lumen/dom";
const _t0 = /* @__PURE__ */ template(`<h3>`);
export async function Member(props) {
	const m = await fetchJSON(`/api/members/${props.id}`);
	const _el = _t0();
	insert(_el, () => m.name);
	return _el;
}
