// Events: camelCase onX delegated for bubbling events, direct listeners for the others and for
// on:x; row handlers that only capture the item and stable bindings move out of the row.
import { signal } from "lumen";
import { ssr, list } from "lumen/server";
const _s0 = ["<li><button>module</button><button>setup</button><button>no item</button><button>index</button><button>mutable</button><button>function</button><button>pointer</button></li>"];
const _s1 = ["<div><input><ul>", "</ul></div>"];
const log = (message) => console.log(message);
export function Events(props) {
	const count = signal(0);
	const reset = () => count.set(0);
	let changing = 0;
	changing = 1;
	return ssr(_s1, list(props.items(), (item, index) => ssr(_s0)));
}
