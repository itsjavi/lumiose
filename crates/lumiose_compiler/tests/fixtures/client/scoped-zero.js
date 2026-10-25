import { template } from "lumiose/dom";
import "/src/scoped-zero.stsx?lumiose&type=style&lang.css";
const _t0 = /* @__PURE__ */ template(`<p class=note data-app-8tlen979>note`);
// @scoped-styles attribute zero app
// Zero specificity and a custom namespace (decision-85): `data-app-<token>` attributes, matched
// through `:where()`.
export function Note() {
	return _t0();
}
