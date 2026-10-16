// Templates with an `<output>` are created with `outputTemplate` (TASK-425): a form reset
// replaces an output's children in Firefox and WebKit, and the helper keeps them. Other
// templates of the module stay plain `template` calls.
import { signal } from "lumiose";
import { template, outputTemplate, insert, insertText, delegateEvents } from "lumiose/dom";
const _t0 = /* @__PURE__ */ outputTemplate(`<form><button type=button>Add</button><output> items`);
const _t1 = /* @__PURE__ */ template(`<p> `);
export function Total() {
	const count = signal(0);
	const _el = _t0(), _button = _el.firstChild, _output = _button.nextSibling, _text = _output.firstChild;
	_button.$$click = () => count.set(count() + 1);
	insert(_output, count, _text);
	return _el;
}
export function Plain(props) {
	const _el2 = _t1(), _text2 = _el2.firstChild;
	insertText(_text2, () => props.label);
	return _el2;
}
delegateEvents(["click"]);
