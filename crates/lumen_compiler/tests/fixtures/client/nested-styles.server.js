// Nested style blocks scope to their enclosing element's subtree (decision-23): one token per
// style-bearing element, stamped on that element and the JSX lexically inside it (children
// passed to components included); call sites passing `class` pass the enclosing chain.
import { Card, Panel } from "./ui.stsx";
import { ssr, insert, insertText, list, createComponent, $await, $leave, $async } from "lumen/server";
import "/src/nested-styles.stsx?lumen&type=style&lang.css";
const _s0 = ["<section class=a data-l-nmviz5ch data-l-wepye2d9><div class=b1 data-l-nmviz5ch data-l-wepye2d9><p class=c1 data-l-nmviz5ch data-l-wepye2d9>one</p></div><div class=b2 data-l-nmviz5ch data-l-wepye2d9><p class=c2 data-l-nmviz5ch data-l-wepye2d9 data-l-44pntcw3>two</p></div></section>"];
const _s1 = ["<p class=note data-l-nmviz5ch data-l-238shbm8>inside the subtree</p>"];
const _s2 = [
	"<main data-l-nmviz5ch><header class=head data-l-nmviz5ch data-l-7ikt7jyc>",
	"</header><article class=body data-l-nmviz5ch data-l-238shbm8>",
	"</article>",
	"</main>"
];
const _s3 = ["<li class=item data-l-nmviz5ch data-l-jwlnrxd5 data-l-pqjmvna1>", "</li>"];
const _s4 = ["<tr data-l-nmviz5ch data-l-jwlnrxd5 data-l-qcwvws3i><td data-l-nmviz5ch data-l-jwlnrxd5 data-l-qcwvws3i>", "</td></tr>"];
const _s5 = [
	"<ul class=list data-l-nmviz5ch data-l-jwlnrxd5 data-l-pqjmvna1>",
	"</ul><table data-l-nmviz5ch data-l-jwlnrxd5 data-l-qcwvws3i><tbody data-l-nmviz5ch data-l-jwlnrxd5 data-l-qcwvws3i>",
	"</tbody></table><table data-l-nmviz5ch data-l-jwlnrxd5><tbody data-l-nmviz5ch data-l-jwlnrxd5><tr class=row data-l-nmviz5ch data-l-jwlnrxd5 data-l-gw6dys2h><td data-l-nmviz5ch data-l-jwlnrxd5 data-l-gw6dys2h>static</td></tr></tbody></table>"
];
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
	return ssr(_s2, insert(createComponent(Card, {
		class: "title",
		$$scope: "data-l-nmviz5ch data-l-7ikt7jyc",
		get children() {
			return props.label;
		}
	})), insert(createComponent(Panel, {
		class: "panel",
		$$scope: "data-l-nmviz5ch data-l-238shbm8",
		get children() {
			return ssr(_s1);
		}
	})), insert(createComponent(Card, {
		class: "outside",
		$$scope: "data-l-nmviz5ch",
		children: "no subtree tokens"
	})));
}
// An async component with a nested block, and rows from .map() in styled lists and tables.
export async function Rows(props) {
	try {
		const items = (await $await(() => props.load(), 0))();
		return ssr(_s5, list(items, (item) => ssr(_s3, insertText(item))), list(items, (item) => ssr(_s4, insertText(item))));
	} finally {
		$leave();
	}
}

// --- diagnostics ---
// LUM3005 warning 20:45 `.c1` matches no element in the `<p>` subtree of component `Tree`
