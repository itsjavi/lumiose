// Nested style blocks scope to their enclosing element's subtree (decision-23): one token per
// style-bearing element, stamped on that element and the JSX lexically inside it (children
// passed to components included); call sites passing `class` pass the enclosing chain.
import { Card, Panel } from "./ui.stsx";
import { template, insert, insertText, list, createComponent, $await, $leave, $async } from "lumiose/dom";
import "/src/nested-styles.stsx?lumiose&type=style&lang.css";
const _t0 = /* @__PURE__ */ template(`<section class=a data-l-nmviz5ch data-l-wepye2d9><div class=b1 data-l-nmviz5ch data-l-wepye2d9><p class=c1 data-l-nmviz5ch data-l-wepye2d9>one</p></div><div class=b2 data-l-nmviz5ch data-l-wepye2d9><p class=c2 data-l-nmviz5ch data-l-wepye2d9 data-l-44pntcw3>two`);
const _t1 = /* @__PURE__ */ template(`<p class=note data-l-nmviz5ch data-l-238shbm8>inside the subtree`);
const _t2 = /* @__PURE__ */ template(`<main data-l-nmviz5ch><header class=head data-l-nmviz5ch data-l-7ikt7jyc></header><article class=body data-l-nmviz5ch data-l-238shbm8>`);
const _t3 = /* @__PURE__ */ template(`<li class=item data-l-nmviz5ch data-l-jwlnrxd5 data-l-pqjmvna1> `);
const _t4 = /* @__PURE__ */ template(`<tr data-l-nmviz5ch data-l-jwlnrxd5 data-l-qcwvws3i><td data-l-nmviz5ch data-l-jwlnrxd5 data-l-qcwvws3i> `);
const _t5 = /* @__PURE__ */ template(`<ul class=list data-l-nmviz5ch data-l-jwlnrxd5 data-l-pqjmvna1></ul><table data-l-nmviz5ch data-l-jwlnrxd5 data-l-qcwvws3i><tbody data-l-nmviz5ch data-l-jwlnrxd5 data-l-qcwvws3i></tbody></table><table data-l-nmviz5ch data-l-jwlnrxd5><tbody data-l-nmviz5ch data-l-jwlnrxd5><tr class=row data-l-nmviz5ch data-l-jwlnrxd5 data-l-gw6dys2h><td data-l-nmviz5ch data-l-jwlnrxd5 data-l-gw6dys2h>static`, 1);
$async(Rows);
// A → B1 → C1 and A → B2 → C2 → <style>: C1 is not styled by C2's blocks (and `.c1` there is
// LUM3005, labelled with the `<p>` subtree). The root block covers the whole component; blocks
// under one element share a token. Nested blocks see the @keyframes of enclosing subtrees: `fade`
// resolves to the root's, `pulse` to C2's own.
export function Tree() {
	return _t0();
}
// Sibling subtrees, class passthrough and children passed to a component inside a subtree.
export function Siblings(props) {
	const _el = _t2(), _header = _el.firstChild, _article = _header.nextSibling;
	insert(_header, createComponent(Card, {
		class: "title",
		$$scope: "data-l-nmviz5ch data-l-7ikt7jyc",
		get children() {
			return props.label;
		}
	}));
	insert(_article, createComponent(Panel, {
		class: "panel",
		$$scope: "data-l-nmviz5ch data-l-238shbm8",
		get children() {
			return _t1();
		}
	}));
	insert(_el, createComponent(Card, {
		class: "outside",
		$$scope: "data-l-nmviz5ch",
		children: "no subtree tokens"
	}));
	return _el;
}
// An async component with a nested block, and rows from .map() in styled lists and tables.
export async function Rows(props) {
	try {
		const items = (await $await(() => props.load(), 0))();
		const _nodes = _t5(), _ul = _nodes[0], _table = _nodes[1], _tbody = _table.firstChild;
		list(_ul, null, () => items, (item) => {
			const _el2 = _t3(), _text = _el2.firstChild;
			insertText(_text, item);
			return _el2;
		});
		list(_tbody, null, () => items, (item) => {
			const _el3 = _t4(), _text2 = _el3.firstChild.firstChild;
			insertText(_text2, item);
			return _el3;
		});
		return _nodes;
	} finally {
		$leave();
	}
}

// --- diagnostics ---
// LUM3005 warning 20:45 `.c1` matches no element in the `<p>` subtree of component `Tree`
