import { ssr } from "lumiose/server";
import "/src/scoped-zero.stsx?lumiose&type=style&lang.css";
const _s0 = ["<p class=note data-app-8tlen979>note</p>"];
// @scoped-styles attribute zero app
// Zero specificity and a custom namespace (decision-85): `data-app-<token>` attributes, matched
// through `:where()`.
export function Note() {
	return ssr(_s0);
}
