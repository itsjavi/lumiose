// The one module pages and islands import messages from. Paraglide's message functions read the
// locale through its runtime's getLocale(); here that is Lumiose's locale(): on the server the
// request's (from its async context, so concurrent requests never mix), in the browser the page's.
import { locale } from "lumiose/router";
import { overwriteGetLocale } from "../paraglide/runtime.js";

overwriteGetLocale(() => locale());

export { m } from "../paraglide/messages.js";
