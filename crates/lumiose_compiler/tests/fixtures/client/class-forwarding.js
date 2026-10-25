import { template, bind, setClass, insert, insertText, createComponent, applyScope } from "lumiose/dom";
import "/src/class-forwarding.tsx?lumiose&type=style&lang.css";
const _t0 = /* @__PURE__ */ template(`<span> `);
const _t1 = /* @__PURE__ */ template(`<div data-lum-xv47rtvg>`);
const _t2 = /* @__PURE__ */ template(`<section data-lum-h4k9s2t6>`);
const _t3 = /* @__PURE__ */ template(`<main data-lum-7mclcxns><!>`);
function Inner(props) {
	const _el = _t0(), _text = _el.firstChild;
	bind(_el, () => props.class, setClass);
	applyScope(_el, props.$$scope);
	insertText(_text, () => props.label);
	return _el;
}
// Styled: its own tokens plus the caller's.
export function Middle(props) {
	const _el2 = _t1();
	insert(_el2, createComponent(Inner, {
		get class() {
			return ["middle", props.class];
		},
		get label() {
			return props.label;
		},
		$$scope: "data-lum-xv47rtvg " + (props.$$scope ?? "")
	}));
	return _el2;
}
// Unstyled and destructured: only the caller's.
export function Plain(props) {
	return createComponent(Inner, {
		get class() {
			return props.class;
		},
		get label() {
			return props.label;
		},
		$$scope: props.$$scope
	});
}
// A class that is not the component's own carries only the own tokens.
export function Own(props) {
	const _el3 = _t2();
	insert(_el3, createComponent(Inner, {
		class: "own",
		get label() {
			return props.label;
		},
		$$scope: "data-lum-h4k9s2t6"
	}));
	return _el3;
}
export function Outer() {
	const _el4 = _t3(), _marker = _el4.firstChild;
	insert(_el4, createComponent(Middle, {
		class: "cta",
		label: "a",
		$$scope: "data-lum-7mclcxns"
	}), _marker);
	insert(_el4, createComponent(Plain, {
		class: "cta",
		label: "b",
		$$scope: "data-lum-7mclcxns"
	}));
	return _el4;
}

// --- diagnostics ---
// LUM1006 error 15:7 raw CSS in a `.tsx` file
// LUM1006 error 30:7 raw CSS in a `.tsx` file
// LUM1006 error 40:7 raw CSS in a `.tsx` file
