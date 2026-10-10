// Contract doc-2 §5.4: $async tagging, the await rewrite and the try/finally `$leave()` wrapper.
import { fetchJSON } from "lumiose";
import { template, insertText, $await, $leave, $async } from "lumiose/dom";
const _t0 = /* @__PURE__ */ template(`<h3> `);
$async(Member);
export async function Member(props) {
	try {
		const m = (await $await(() => fetchJSON(`/api/members/${props.id}`), 0))();
		const _el = _t0(), _text = _el.firstChild;
		insertText(_text, () => m.name);
		return _el;
	} finally {
		$leave();
	}
}
