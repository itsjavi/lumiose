import { ssr, insert, attr, list } from "lumiose/server";
const _s0 = [
	"<circle class=dot r=2",
	"",
	"></circle>"
];
const _s1 = [
	"<svg viewBox=\"0 0 100 100\" xmlns=http://www.w3.org/2000/svg><style>.dot { fill: $notARef; }</style><g class=dots>",
	"</g><foreignObject width=100 height=20><p>HTML inside</p></foreignObject><text x=0 y=10>",
	" points</text></svg>"
];
const _s2 = ["<path d=\"M0 0L10 10\" stroke=black></path>"];
const _s3 = ["<mrow><mi>x</mi><mo>=</mo><mn>2</mn></mrow>"];
const _s4 = ["<math><mi>y</mi></math>"];
// Namespaces: <svg> parses in place; SVG-only roots get the Svg flag; SVG <style> is native CSS
// emitted verbatim; foreignObject switches back to HTML; MathML roots get the MathMl flag.
export function Chart(props) {
	return ssr(_s1, list(props.points(), (p) => ssr(_s0, attr("cx", p.x), attr("cy", p.y))), insert(props.points().length));
}
export function Marker() {
	return ssr(_s2);
}
export function Formula() {
	return ssr(_s3);
}
export function MathBlock() {
	return ssr(_s4);
}
