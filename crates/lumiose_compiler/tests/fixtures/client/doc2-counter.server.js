// Contract doc-2 §5.1: static and dynamic text, delegated event, class object, scoped style.
import { signal } from "lumiose";
import { ssr, SSRHtml, insert, classAttr } from "lumiose/server";
import "/src/doc2-counter.stsx?lumiose&type=style&lang.css";
const _s0 = [
	"<button data-l-kuy18vvn",
	">Clicked ",
	" times</button>"
];
const _c0 = (h0, h1) => typeof h0 === "string" && typeof h1 === "string" ? new SSRHtml("<button data-l-kuy18vvn" + h0 + ">Clicked " + h1 + " times</button>") : ssr(_s0, h0, h1);
export function Counter(props) {
	const count = signal(props.start === void 0 ? 0 : props.start);
	return _c0(classAttr({ hot: count() > 5 }), insert(count()));
}
