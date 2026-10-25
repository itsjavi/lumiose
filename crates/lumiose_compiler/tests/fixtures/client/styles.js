// Style blocks: masked ranges are deleted before whitespace normalisation, $ref placeholders
// are dropped, imports used only by $refs are removed, every element of a scope carries its
// token, and the CSS has the file scope first, then component blocks in source order.
import { used } from "./tokens.ts";
import { template, insertText, list } from "lumiose/dom";
import "/src/styles.stsx?lumiose&type=style&lang.css";
const _t0 = /* @__PURE__ */ template(`<span class=item data-lum-ecz843t9 data-lum-wjsvhj1q> `);
const _t1 = /* @__PURE__ */ template(`<div class=card data-lum-ecz843t9 data-lum-wjsvhj1q><b data-lum-ecz843t9 data-lum-wjsvhj1q> </b><i data-lum-ecz843t9 data-lum-wjsvhj1q> `);
const _t2 = /* @__PURE__ */ template(`<footer data-lum-ecz843t9>Footer`);
const gap = 4;
export function Card(props) {
	const _el2 = _t1(), _b = _el2.firstChild, _text2 = _b.firstChild, _text3 = _b.nextSibling.firstChild;
	insertText(_text2, () => props.title);
	insertText(_text3, used);
	list(_el2, null, () => [1, 2], (n) => {
		const _el = _t0(), _text = _el.firstChild;
		insertText(_text, n);
		return _el;
	});
	return _el2;
}
export const Footer = () => _t2();

// --- diagnostics ---
// LUM3018 warning 10:57 `$radius.lg` is a unitless number (`8`) where `border-radius` needs a length
