// @scope Counter=data-l-c1
// Contract doc-2 §5.1: static and dynamic text, delegated event, class object, scoped style.
import { signal } from "lumen";
import { ssr, insert, classAttr } from "lumen/server";
import "/src/doc2-counter.stsx?lumen&type=style&lang.css";
const _s0 = [
	"<button data-l-c1",
	">Clicked ",
	" times</button>"
];
export function Counter(props) {
	const count = signal(props.start === void 0 ? 0 : props.start);
	return ssr(_s0, classAttr({ hot: count() > 5 }), insert(count()));
}
