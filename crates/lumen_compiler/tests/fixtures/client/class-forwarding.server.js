import { ssr, insert, insertText, classAttr, spreadAttrs, createComponent } from "lumen/server";
import "/src/class-forwarding.tsx?lumen&type=style&lang.css";
const _s0 = [
	"<span",
	"",
	">",
	"</span>"
];
const _s1 = ["<div data-l-xv47rtvg>", "</div>"];
const _s2 = ["<section data-l-h4k9s2t6>", "</section>"];
const _s3 = [
	"<main data-l-7mclcxns>",
	"",
	"</main>"
];
function Inner(props) {
	return ssr(_s0, classAttr(props.class), spreadAttrs({ $$scope: props.$$scope }), insertText(props.label));
}
// Styled: its own tokens plus the caller's.
export function Middle(props) {
	return ssr(_s1, insert(createComponent(Inner, {
		get class() {
			return ["middle", props.class];
		},
		label: props.label,
		$$scope: "data-l-xv47rtvg " + (props.$$scope ?? "")
	})));
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
	return ssr(_s2, insert(createComponent(Inner, {
		class: "own",
		label: props.label,
		$$scope: "data-l-h4k9s2t6"
	})));
}
export function Outer() {
	return ssr(_s3, insert(createComponent(Middle, {
		class: "cta",
		label: "a",
		$$scope: "data-l-7mclcxns"
	})), insert(createComponent(Plain, {
		class: "cta",
		label: "b",
		$$scope: "data-l-7mclcxns"
	})));
}

// --- diagnostics ---
// LUM1006 error 15:7 raw CSS in a `.tsx` file
// LUM1006 error 30:7 raw CSS in a `.tsx` file
// LUM1006 error 40:7 raw CSS in a `.tsx` file
