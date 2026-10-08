// Contract doc-2 §5.4: $async tagging, the await rewrite and the try/finally `$leave()` wrapper.
import { fetchJSON } from "lumen";
import { template, insert, $await, $leave, $async } from "lumen/dom";
const _t0 = /* @__PURE__ */ template(`<h3>`);
export const Member = /* @__PURE__ */ $async(async function Member(props) {
	try {
		const m = (await $await(() => fetchJSON(`/api/members/${props.id}`), 0))();
		const _el = _t0();
		insert(_el, () => m.name);
		return _el;
	} finally {
		$leave();
	}
});
