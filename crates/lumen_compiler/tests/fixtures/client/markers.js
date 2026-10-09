// Insertion markers: <!> only between text and text or before another dynamic part; a following
// static node is used as the marker otherwise; the last dynamic part appends.
import { signal } from "lumen";
import { Card } from "./Card.stsx";
import { template, insert, insertText, createComponent } from "lumen/dom";
const _t0 = /* @__PURE__ */ template(`<div><p>before <!> after</p><p><!></p><p> trailing text</p><p><br> <br></p><p>leading </p><p><!><!></p><p> `);
export function Markers() {
	const a = signal("a");
	const b = signal("b");
	const _el = _t0(), _p = _el.firstChild, _marker = _p.firstChild.nextSibling, _p2 = _p.nextSibling, _marker2 = _p2.firstChild, _p3 = _p2.nextSibling, _text = _p3.firstChild, _p4 = _p3.nextSibling, _text2 = _p4.firstChild.nextSibling, _p5 = _p4.nextSibling, _p6 = _p5.nextSibling, _marker3 = _p6.firstChild, _marker4 = _marker3.nextSibling, _text3 = _p6.nextSibling.firstChild;
	insert(_p, a, _marker);
	insert(_p2, a, _marker2);
	insert(_p2, b);
	insert(_p3, a, _text);
	insertText(_text2, a);
	insert(_p5, a);
	insert(_p6, createComponent(Card, {}), _marker3);
	insert(_p6, b, _marker4);
	insert(_p6, createComponent(Card, {}));
	insertText(_text3, a);
	return _el;
}
