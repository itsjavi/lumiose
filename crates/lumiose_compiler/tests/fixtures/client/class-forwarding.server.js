import { ssr, SSRHtml, insert, insertText, classAttr, spreadAttrs, createComponent } from "lumiose/server";
import "/src/class-forwarding.tsx?lumiose&type=style&lang.css";
const _s0 = [
	"<span",
	"",
	">",
	"</span>"
];
const _c0 = (h0, h1, h2) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" ? new SSRHtml("<span" + h0 + h1 + ">" + h2 + "</span>") : ssr(_s0, h0, h1, h2);
const _s1 = ["<div data-lum-xv47rtvg>", "</div>"];
const _c1 = (h0) => typeof h0 === "string" ? new SSRHtml("<div data-lum-xv47rtvg>" + h0 + "</div>") : ssr(_s1, h0);
const _s2 = ["<section data-lum-h4k9s2t6>", "</section>"];
const _c2 = (h0) => typeof h0 === "string" ? new SSRHtml("<section data-lum-h4k9s2t6>" + h0 + "</section>") : ssr(_s2, h0);
const _s3 = [
	"<main data-lum-7mclcxns>",
	"",
	"</main>"
];
const _c3 = (h0, h1) => typeof h0 === "string" && typeof h1 === "string" ? new SSRHtml("<main data-lum-7mclcxns>" + h0 + h1 + "</main>") : ssr(_s3, h0, h1);
function Inner(props) {
	return _c0(classAttr(props.class), spreadAttrs({ $$scope: props.$$scope }), insertText(props.label));
}
// Styled: its own tokens plus the caller's.
export function Middle(props) {
	return _c1(insert(createComponent(Inner, ((_d, _v) => ({
		get class() {
			return _d ? _v : (_v = ["middle", props.class], _d = true, _v);
		},
		label: props.label,
		$$scope: "data-lum-xv47rtvg " + (props.$$scope ?? "")
	}))())));
}
// Unstyled and destructured: only the caller's.
export function Plain(props) {
	return createComponent(Inner, {
		class: props.class,
		label: props.label,
		$$scope: props.$$scope
	});
}
// A class that is not the component's own carries only the own tokens.
export function Own(props) {
	return _c2(insert(createComponent(Inner, {
		class: "own",
		label: props.label,
		$$scope: "data-lum-h4k9s2t6"
	})));
}
export function Outer() {
	return _c3(insert(createComponent(Middle, {
		class: "cta",
		label: "a",
		$$scope: "data-lum-7mclcxns"
	})), insert(createComponent(Plain, {
		class: "cta",
		label: "b",
		$$scope: "data-lum-7mclcxns"
	})));
}

// --- diagnostics ---
// LUM1006 error 15:7 raw CSS in a `.tsx` file
// LUM1006 error 30:7 raw CSS in a `.tsx` file
// LUM1006 error 40:7 raw CSS in a `.tsx` file
