// Conditionals: a reactive test with a JSX arm compiles to a memoised branch; static tests are
// evaluated once; a component returning a reactive conditional returns a tracked function.
import { signal } from "lumen";
import { ssr, insert, branch } from "lumen/server";
const _s0 = ["<p>Open</p>"];
const _s1 = ["<p>Closed</p>"];
const _s2 = ["<span>Visible</span>"];
const _s3 = ["<b>", "</b>"];
const _s4 = ["<i>A</i>"];
const _s5 = ["<i>B</i>"];
const _s6 = ["<i>C</i>"];
const _s7 = ["<em>Static</em>"];
const _s8 = ["<em>Never</em>"];
const _s9 = [
	"<div>",
	"",
	"",
	"",
	"",
	"",
	"</div>"
];
const _s10 = ["<p>On</p>"];
const _s11 = ["<p>Off</p>"];
export function Branches(props) {
	const open = signal(false);
	const loggedIn = true;
	return ssr(_s9, branch(open(), () => ssr(_s0), () => ssr(_s1)), branch(open(), () => ssr(_s2)), branch(props.user, () => ssr(_s3, insert(props.user.name))), branch(props.mode === "a", () => ssr(_s4), () => () => props.mode === "b" ? ssr(_s5) : ssr(_s6)), insert(loggedIn ? ssr(_s7) : ssr(_s8)), insert(open() ? "yes" : "no"));
}
export function Switch(props) {
	return props.on ? ssr(_s10) : ssr(_s11);
}
