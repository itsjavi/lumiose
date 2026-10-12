// Contract doc-2 §5.4: $async tagging, the await rewrite and the try/finally `$leave()` wrapper.
import { fetchJSON } from "lumiose";
import { ssr, SSRHtml, insertText, $await, $leave, $async } from "lumiose/server";
const _s0 = ["<h3>", "</h3>"];
const _c0 = (h0) => typeof h0 === "string" ? new SSRHtml("<h3>" + h0 + "</h3>") : ssr(_s0, h0);
$async(Member);
export async function Member(props) {
	try {
		const m = (await $await(() => fetchJSON(`/api/members/${props.id}`), 0))();
		return _c0(insertText(m.name));
	} finally {
		$leave();
	}
}
