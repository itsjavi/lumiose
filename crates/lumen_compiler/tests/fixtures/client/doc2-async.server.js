// Contract doc-2 §5.4: $async tagging, the await rewrite and the try/finally `$leave()` wrapper.
import { fetchJSON } from "lumen";
import { ssr, insertText, $await, $leave, $async } from "lumen/server";
const _s0 = ["<h3>", "</h3>"];
$async(Member);
export async function Member(props) {
	try {
		const m = (await $await(() => fetchJSON(`/api/members/${props.id}`), 0))();
		return ssr(_s0, insertText(m.name));
	} finally {
		$leave();
	}
}
