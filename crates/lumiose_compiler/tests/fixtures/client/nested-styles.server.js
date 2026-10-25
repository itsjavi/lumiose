// Nested style blocks scope to their enclosing element's subtree (decision-23): one token per
// style-bearing element, stamped on that element and the JSX lexically inside it (children
// passed to components included); call sites passing `class` pass the enclosing chain.
import { Card, Panel } from "./ui.stsx";
import { ssr, SSRHtml, insert, insertText, list, createComponent, $await, $leave, $async } from "lumiose/server";
import "/src/nested-styles.stsx?lumiose&type=style&lang.css";
const _s0 = ["<section class=a data-lum-nmviz5ch data-lum-wepye2d9><div class=b1 data-lum-nmviz5ch data-lum-wepye2d9><p class=c1 data-lum-nmviz5ch data-lum-wepye2d9>one</p></div><div class=b2 data-lum-nmviz5ch data-lum-wepye2d9><p class=c2 data-lum-nmviz5ch data-lum-wepye2d9 data-lum-44pntcw3>two</p></div></section>"];
const _s1 = ["<p class=note data-lum-nmviz5ch data-lum-238shbm8>inside the subtree</p>"];
const _s2 = [
	"<main data-lum-nmviz5ch><header class=head data-lum-nmviz5ch data-lum-7ikt7jyc>",
	"</header><article class=body data-lum-nmviz5ch data-lum-238shbm8>",
	"</article>",
	"</main>"
];
const _c2 = (h0, h1, h2) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" ? new SSRHtml("<main data-lum-nmviz5ch><header class=head data-lum-nmviz5ch data-lum-7ikt7jyc>" + h0 + "</header><article class=body data-lum-nmviz5ch data-lum-238shbm8>" + h1 + "</article>" + h2 + "</main>") : ssr(_s2, h0, h1, h2);
const _s3 = ["<li class=item data-lum-nmviz5ch data-lum-jwlnrxd5 data-lum-pqjmvna1>", "</li>"];
const _c3 = (h0) => typeof h0 === "string" ? new SSRHtml("<li class=item data-lum-nmviz5ch data-lum-jwlnrxd5 data-lum-pqjmvna1>" + h0 + "</li>") : ssr(_s3, h0);
const _s4 = ["<tr data-lum-nmviz5ch data-lum-jwlnrxd5 data-lum-qcwvws3i><td data-lum-nmviz5ch data-lum-jwlnrxd5 data-lum-qcwvws3i>", "</td></tr>"];
const _c4 = (h0) => typeof h0 === "string" ? new SSRHtml("<tr data-lum-nmviz5ch data-lum-jwlnrxd5 data-lum-qcwvws3i><td data-lum-nmviz5ch data-lum-jwlnrxd5 data-lum-qcwvws3i>" + h0 + "</td></tr>") : ssr(_s4, h0);
const _s5 = [
	"<ul class=list data-lum-nmviz5ch data-lum-jwlnrxd5 data-lum-pqjmvna1>",
	"</ul><table data-lum-nmviz5ch data-lum-jwlnrxd5 data-lum-qcwvws3i><tbody data-lum-nmviz5ch data-lum-jwlnrxd5 data-lum-qcwvws3i>",
	"</tbody></table><table data-lum-nmviz5ch data-lum-jwlnrxd5><tbody data-lum-nmviz5ch data-lum-jwlnrxd5><tr class=row data-lum-nmviz5ch data-lum-jwlnrxd5 data-lum-gw6dys2h><td data-lum-nmviz5ch data-lum-jwlnrxd5 data-lum-gw6dys2h>static</td></tr></tbody></table>"
];
const _c5 = (h0, h1) => h0 instanceof SSRHtml && h1 instanceof SSRHtml ? new SSRHtml("<ul class=list data-lum-nmviz5ch data-lum-jwlnrxd5 data-lum-pqjmvna1>" + h0.t + "</ul><table data-lum-nmviz5ch data-lum-jwlnrxd5 data-lum-qcwvws3i><tbody data-lum-nmviz5ch data-lum-jwlnrxd5 data-lum-qcwvws3i>" + h1.t + "</tbody></table><table data-lum-nmviz5ch data-lum-jwlnrxd5><tbody data-lum-nmviz5ch data-lum-jwlnrxd5><tr class=row data-lum-nmviz5ch data-lum-jwlnrxd5 data-lum-gw6dys2h><td data-lum-nmviz5ch data-lum-jwlnrxd5 data-lum-gw6dys2h>static</td></tr></tbody></table>") : ssr(_s5, h0, h1);
$async(Rows);
// A → B1 → C1 and A → B2 → C2 → <style>: C1 is not styled by C2's blocks (and `.c1` there is
// LUM3005, labelled with the `<p>` subtree). The root block covers the whole component; blocks
// under one element share a token. Nested blocks see the @keyframes of enclosing subtrees: `fade`
// resolves to the root's, `pulse` to C2's own.
export function Tree() {
	return ssr(_s0);
}
// Sibling subtrees, class passthrough and children passed to a component inside a subtree.
export function Siblings(props) {
	return _c2(insert(createComponent(Card, ((_d, _v) => ({
		class: "title",
		$$scope: "data-lum-nmviz5ch data-lum-7ikt7jyc",
		get children() {
			return _d ? _v : (_v = props.label, _d = true, _v);
		}
	}))())), insert(createComponent(Panel, ((_d2, _v2) => ({
		class: "panel",
		$$scope: "data-lum-nmviz5ch data-lum-238shbm8",
		get children() {
			return _d2 ? _v2 : (_v2 = ssr(_s1), _d2 = true, _v2);
		}
	}))())), insert(createComponent(Card, {
		class: "outside",
		$$scope: "data-lum-nmviz5ch",
		children: "no subtree tokens"
	})));
}
// An async component with a nested block, and rows from .map() in styled lists and tables.
export async function Rows(props) {
	try {
		const items = (await $await(() => props.load(), 0))();
		return _c5(list(items, (item) => _c3(insertText(item))), list(items, (item) => _c4(insertText(item))));
	} finally {
		$leave();
	}
}

// --- diagnostics ---
// LUM3005 warning 20:45 `.c1` matches no element in the `<p>` subtree of component `Tree`
