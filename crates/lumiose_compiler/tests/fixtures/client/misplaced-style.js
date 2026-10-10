import { template, insert, insertText } from "lumiose/dom";
import "/src/misplaced-style.stsx?lumiose&type=style&lang.css";
const _t0 = /* @__PURE__ */ template(`<li data-l-3y536f6d> `);
const _t1 = /* @__PURE__ */ template(`<footer data-l-snjkckt6>`);
const _t2 = /* @__PURE__ */ template(`<ul><!>`);
const _t3 = /* @__PURE__ */ template(`<p>`);
// LUM3010 found on the AST: blocks inside .map() callbacks and nested functions (the scanner
// cannot see these placements).
export function List(props) {
	const rows = props.items.map((item) => {
		const _el = _t0(), _text = _el.firstChild;
		insertText(_text, item);
		return _el;
	});
	const renderFooter = () => _t1();
	const _el2 = _t2(), _marker = _el2.firstChild;
	insert(_el2, rows, _marker);
	insert(_el2, renderFooter);
	return _el2;
}
function helper() {
	return _t3();
}

// --- diagnostics ---
// LUM2001 warning 4:9 `rows` is computed once from a reactive value, so the JSX that uses it never updates
// LUM3010 error 7:7 a `<style>` block must be part of a component's static JSX; this one is inside a callback or nested function (such as a `.map()` callback)
// LUM3010 error 12:7 a `<style>` block must be part of a component's static JSX; this one is inside a callback or nested function (such as a `.map()` callback)
// LUM3010 error 21:7 a `<style>` block must be part of a component's static JSX; this one is inside a function that is not a component
