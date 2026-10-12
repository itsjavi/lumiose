import { ssr, SSRHtml, text, insertText, attr, spreadAttrs, restProps, mergeProps } from "lumiose/server";
const _s0 = [
	"<section",
	"><h1>",
	"</h1><p>",
	"</p><button>log</button></section>"
];
const _c0 = (h0, h1, h2) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" ? new SSRHtml("<section" + h0 + "><h1>" + h1 + "</h1><p>" + h2 + "</p><button>log</button></section>") : ssr(_s0, h0, h1, h2);
const _s1 = ["<span>", "</span>"];
const _c1 = (h0) => typeof h0 === "string" ? new SSRHtml("<span>" + h0 + "</span>") : ssr(_s1, h0);
const _s2 = [
	"<p",
	">",
	"</p>"
];
const _c2 = (h0, h1) => typeof h0 === "string" && typeof h1 === "string" ? new SSRHtml("<p" + h0 + ">" + h1 + "</p>") : ssr(_s2, h0, h1);
const _s3 = ["<p>", "</p>"];
const _c3 = (h0) => typeof h0 === "string" ? new SSRHtml("<p>" + h0 + "</p>") : ssr(_s3, h0);
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
	return _c0(spreadAttrs(mergeProps({
		class: props.class,
		get "data-name"() {
			return (props.user === void 0 ? {} : props.user).name === void 0 ? "anon" : (props.user === void 0 ? {} : props.user).name;
		}
	}, rest)), insertText(props.title), text((props.count === void 0 ? 1 : props.count) * 2));
}
export const Arrow = (props) => _c1(insertText(props.label));
export function Conflict(_props) {
	const props = { value: 1 };
	return _c2(attr("title", _props.value), insertText(props.value));
}
export function Reassigned({ value }) {
	value = value.trim();
	return _c3(insertText(value));
}
export function Plain(attrs) {
	return _c3(insertText(attrs.value));
}
