// @scope file=data-l-f1 Card=data-l-c1
// Style blocks: masked ranges are deleted before whitespace normalisation, $ref placeholders
// are dropped, imports used only by $refs are removed, and every element of a scope carries its
// token.
import { used } from "./tokens.ts";
import { template, insert, list } from "lumen/dom";
import "/src/styles.stsx?lumen&type=style&lang.css";
const _t0 = /* @__PURE__ */ template(`<span data-l-f1 data-l-c1>`);
const _t1 = /* @__PURE__ */ template(`<div class=card data-l-f1 data-l-c1><b data-l-f1 data-l-c1></b><i data-l-f1 data-l-c1>`);
const _t2 = /* @__PURE__ */ template(`<footer data-l-f1>Footer`);
const gap = 4;
export function Card(props) {
	const _el2 = _t1(), _b = _el2.firstChild, _i = _b.nextSibling;
	insert(_b, () => props.title);
	insert(_i, used);
	list(_el2, null, () => [1, 2], (n) => {
		const _el = _t0();
		insert(_el, n);
		return _el;
	});
	return _el2;
}
export const Footer = () => _t2();
