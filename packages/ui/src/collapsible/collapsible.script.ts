// Collapsible's client script (decision-62, decision-63): the component works without it, as a
// native `<details>`; on a page that renders one, it runs once and adds the panel's open and close
// measurements and the disabled trigger (./panel.ts), for every Collapsible and Accordion panel.
// It must not import `lumiose`: server-rendered pages load it without the runtime.
import { watchPanels } from "./panel.ts";

watchPanels();
