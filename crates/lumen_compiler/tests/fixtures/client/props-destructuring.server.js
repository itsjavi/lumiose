import { ssr, text, insert, attr, spreadAttrs, restProps, mergeProps } from "lumen/server";
const _s0 = [
	"<section",
	"><h1>",
	"</h1><p>",
	"</p><button>log</button></section>"
];
const _s1 = ["<span>", "</span>"];
const _s2 = [
	"<p",
	">",
	"</p>"
];
const _s3 = ["<p>", "</p>"];
// Reactive props destructuring: reads become props.x (defaults with undefined semantics),
// rest becomes restProps, shorthand properties expand.
export function Props(props) {
	const rest = restProps(props, [
		"title",
		"count",
		"class",
		"user"
	]);
	const payload = () => ({
		title: props.title,
		count: props.count === void 0 ? 1 : props.count
	});
	return ssr(_s0, spreadAttrs(mergeProps({
		class: props.class,
		get "data-name"() {
			return (props.user === void 0 ? {} : props.user).name === void 0 ? "anon" : (props.user === void 0 ? {} : props.user).name;
		}
	}, rest)), insert(props.title), text((props.count === void 0 ? 1 : props.count) * 2));
}
export const Arrow = (props) => ssr(_s1, insert(props.label));
export function Conflict(_props) {
	const props = { value: 1 };
	return ssr(_s2, attr("title", _props.value), insert(props.value));
}
export function Reassigned({ value }) {
	value = value.trim();
	return ssr(_s3, insert(value));
}
export function Plain(attrs) {
	return ssr(_s3, insert(attrs.value));
}
