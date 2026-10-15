// Lumiose's components for the Custom Elements Everywhere tests (TASK-326), the counterpart of a
// library's `src/components.js` upstream. Props on a custom element go to the element's property
// when it defines one, else to the attribute (React 19's rule); `on:name` listens to the event of
// that exact name.
import { signal } from "lumiose";
import "../fixtures/webcomponents/ce-without-children.js";
import "../fixtures/webcomponents/ce-with-children.js";
import "../fixtures/webcomponents/ce-with-properties.js";
import "../fixtures/webcomponents/ce-with-event.js";

export const ComponentWithoutChildren = () => <ce-without-children id="wc" />;

export const ComponentWithChildren = () => <ce-with-children id="wc" />;

export const ComponentWithChildrenRerender = () => {
  const count = signal(1);
  void Promise.resolve().then(() => count.set(count() + 1));
  return <ce-with-children id="wc">{count()}</ce-with-children>;
};

export const ComponentWithDifferentViews = (props: { setToggle: (toggle: () => void) => void }) => {
  const show = signal(true);
  props.setToggle(() => show.set(!show()));
  return <div>{show() ? <ce-with-children id="wc" /> : <div id="dummy">Dummy view</div>}</div>;
};

export const ComponentWithProperties = () => {
  const data = {
    bool: true,
    num: 42,
    str: "Lumiose",
    arr: ["L", "u", "m", "i", "o", "s", "e"],
    obj: { org: "itsjavi", repo: "lumiose" },
    camelCaseObj: { label: "passed" },
  };
  return (
    <ce-with-properties
      id="wc"
      bool={data.bool}
      num={data.num}
      str={data.str}
      arr={data.arr}
      obj={data.obj}
      camelCaseObj={data.camelCaseObj}
    />
  );
};

export const ComponentWithUnregistered = () => {
  const data = {
    bool: true,
    num: 42,
    str: "Lumiose",
    arr: ["L", "u", "m", "i", "o", "s", "e"],
    obj: { org: "itsjavi", repo: "lumiose" },
  };
  return (
    <ce-unregistered
      id="wc"
      bool={data.bool}
      num={data.num}
      str={data.str}
      arr={data.arr}
      obj={data.obj}
    />
  );
};

export const ComponentWithImperativeEvent = () => {
  const handled = signal(false);
  return (
    <div>
      <div id="handled">{String(handled())}</div>
      <ce-with-event
        id="wc"
        ref={(wc: HTMLElement) => wc.addEventListener("camelEvent", () => handled.set(true))}
      />
    </div>
  );
};

export const ComponentWithDeclarativeEvent = () => {
  const lowercase = signal(false);
  const kebab = signal(false);
  const camel = signal(false);
  const caps = signal(false);
  const pascal = signal(false);
  return (
    <div>
      <div id="lowercase">{String(lowercase())}</div>
      <div id="kebab">{String(kebab())}</div>
      <div id="camel">{String(camel())}</div>
      <div id="caps">{String(caps())}</div>
      <div id="pascal">{String(pascal())}</div>
      <ce-with-event
        id="wc"
        on:lowercaseevent={() => lowercase.set(true)}
        on:kebab-event={() => kebab.set(true)}
        on:camelEvent={() => camel.set(true)}
        on:CAPSevent={() => caps.set(true)}
        on:PascalEvent={() => pascal.set(true)}
      />
    </div>
  );
};
