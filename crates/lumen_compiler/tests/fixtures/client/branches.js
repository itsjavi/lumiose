// Conditionals: a reactive test with a JSX arm compiles to a memoised branch; static tests are
// evaluated once; a component returning a reactive conditional returns a tracked function.
import { signal } from "lumen";
import { template, insert, branch, branchValue } from "lumen/dom";
const _t0 = /* @__PURE__ */ template(`<p>Open`);
const _t1 = /* @__PURE__ */ template(`<p>Closed`);
const _t2 = /* @__PURE__ */ template(`<span>Visible`);
const _t3 = /* @__PURE__ */ template(`<b>`);
const _t4 = /* @__PURE__ */ template(`<i>A`);
const _t5 = /* @__PURE__ */ template(`<i>B`);
const _t6 = /* @__PURE__ */ template(`<i>C`);
const _t7 = /* @__PURE__ */ template(`<em>Static`);
const _t8 = /* @__PURE__ */ template(`<em>Never`);
const _t9 = /* @__PURE__ */ template(`<div><!><!><!><!><!>`);
const _t10 = /* @__PURE__ */ template(`<p>On`);
const _t11 = /* @__PURE__ */ template(`<p>Off`);
export function Branches(props) {
	const open = signal(false);
	const loggedIn = true;
	const _el2 = _t9(), _marker = _el2.firstChild, _marker2 = _marker.nextSibling, _marker3 = _marker2.nextSibling, _marker4 = _marker3.nextSibling, _marker5 = _marker4.nextSibling;
	branch(_el2, _marker, open, () => _t0(), () => _t1());
	branch(_el2, _marker2, open, () => _t2());
	branch(_el2, _marker3, () => props.user, () => {
		const _el = _t3();
		insert(_el, () => props.user.name);
		return _el;
	});
	branch(_el2, _marker4, () => props.mode === "a", () => _t4(), () => branchValue(() => props.mode === "b", () => _t5(), () => _t6()));
	insert(_el2, loggedIn ? _t7() : _t8(), _marker5);
	insert(_el2, () => open() ? "yes" : "no");
	return _el2;
}
export function Switch(props) {
	return branchValue(() => props.on, () => _t10(), () => _t11());
}
