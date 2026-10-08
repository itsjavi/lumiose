// Component calls: getter props for reactive reads and JSX, plain values for literals,
// identifiers and functions, a lazy children getter, spreads through mergeProps.
import { signal } from "lumen";
import { Card, ui } from "./ui.stsx";
import { template, insert, createComponent, mergeProps } from "lumen/dom";
const _t0 = /* @__PURE__ */ template(`Hello <b>`, 1);
const _t1 = /* @__PURE__ */ template(`<p>Element only`);
const _t2 = /* @__PURE__ */ template(`<i>row`);
const _t3 = /* @__PURE__ */ template(`<div><!><!><!><!><!><!><!><!>`);
export function App(props) {
	const user = signal({ name: "Ada" });
	const handler = () => user.set({ name: "Bob" });
	const size = 3;
	const _el = _t3(), _marker = _el.firstChild, _marker2 = _marker.nextSibling, _marker3 = _marker2.nextSibling, _marker4 = _marker3.nextSibling, _marker5 = _marker4.nextSibling, _marker6 = _marker5.nextSibling, _marker7 = _marker6.nextSibling, _marker8 = _marker7.nextSibling;
	insert(_el, createComponent(Card, {
		title: "Static",
		count: 1,
		enabled: true,
		flag: false,
		onSelect: handler,
		size
	}), _marker);
	insert(_el, createComponent(Card, {
		get title() {
			return user().name;
		},
		get children() {
			const _nodes = _t0(), _b = _nodes[1];
			insert(_b, () => user().name);
			return _nodes;
		}
	}), _marker2);
	insert(_el, createComponent(Card, { get children() {
		return user().name;
	} }), _marker3);
	insert(_el, createComponent(Card, { get children() {
		return "Text only";
	} }), _marker4);
	insert(_el, createComponent(Card, { get children() {
		return _t1();
	} }), _marker5);
	insert(_el, createComponent(Card, {
		get icon() {
			return createComponent(props.Icon, {});
		},
		render: () => _t2()
	}), _marker6);
	insert(_el, createComponent(Card, mergeProps(props.extra, { title: "after" }, { a: 1 })), _marker7);
	insert(_el, createComponent(ui.Panel.Header, { level: 2 }), _marker8);
	insert(_el, createComponent(props.Icon, { size: 16 }));
	return _el;
}
export const Wrapper = (props) => createComponent(Card, { get children() {
	return props.children;
} });
