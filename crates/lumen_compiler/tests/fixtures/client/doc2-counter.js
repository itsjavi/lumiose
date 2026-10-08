// @scope Counter=data-l-c1
// Contract doc-2 §5.1: static and dynamic text, delegated event, class object, scoped style.
import { signal } from "lumen";
import { template, bind, toggleClass, insert, delegateEvents } from "lumen/dom";
import "/src/doc2-counter.stsx?lumen&type=style&lang.css";
const _t0 = /* @__PURE__ */ template(`<button data-l-c1>Clicked <!> times`);
const _a0 = (el, v) => toggleClass(el, "hot", v);
export function Counter(props) {
	const count = signal(props.start === void 0 ? 0 : props.start);
	const _el = _t0(), _marker = _el.firstChild.nextSibling;
	bind(_el, () => count() > 5, _a0);
	_el.$$click = () => count.update((c) => c + 1);
	insert(_el, count, _marker);
	return _el;
}
delegateEvents(["click"]);
