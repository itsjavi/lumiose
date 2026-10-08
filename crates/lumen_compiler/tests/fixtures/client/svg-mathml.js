import { template, bind, setAttr, insert, list } from "lumen/dom";
const _t0 = /* @__PURE__ */ template(`<circle class=dot r=2>`, 2);
const _t1 = /* @__PURE__ */ template(`<svg viewBox="0 0 100 100" xmlns=http://www.w3.org/2000/svg><style>.dot { fill: $notARef; }</style><g class=dots></g><foreignObject width=100 height=20><p>HTML inside</p></foreignObject><text x=0 y=10> points`);
const _t2 = /* @__PURE__ */ template(`<path d="M0 0L10 10" stroke=black>`, 2);
const _t3 = /* @__PURE__ */ template(`<mrow><mi>x</mi><mo>=</mo><mn>2`, 4);
const _t4 = /* @__PURE__ */ template(`<math><mi>y`);
const _a0 = (el, v) => setAttr(el, "cx", v);
const _a1 = (el, v) => setAttr(el, "cy", v);
// Namespaces: <svg> parses in place; SVG-only roots get the Svg flag; SVG <style> is native CSS
// emitted verbatim; foreignObject switches back to HTML; MathML roots get the MathMl flag.
export function Chart(props) {
	const _el2 = _t1(), _g = _el2.firstChild.nextSibling, _text = _g.nextSibling.nextSibling, _text2 = _text.firstChild;
	list(_g, null, () => props.points(), (p) => {
		const _el = _t0();
		bind(_el, () => p.x, _a0);
		bind(_el, () => p.y, _a1);
		return _el;
	});
	insert(_text, () => props.points().length, _text2);
	return _el2;
}
export function Marker() {
	return _t2();
}
export function Formula() {
	return _t3();
}
export function MathBlock() {
	return _t4();
}
