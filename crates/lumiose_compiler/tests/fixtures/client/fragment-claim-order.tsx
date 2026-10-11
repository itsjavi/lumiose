// Arrays of renderables are created in document order, so that hydration claims the server nodes
// in the same order (TASK-234). Dynamic items render into `insertValue` ranges on the client and
// `insert` blocks on the server; runs of static items are templates of their own.
import { signal } from "lumiose";
import { Card } from "./Card.stsx";

const show = signal(true);
const items = signal(["x", "y"]);
const name = signal("Ada");

function item(label: string) {
  return <span class="item">{label}</span>;
}

// The TASK-218 repro: inserts before a static element in a conditional fragment.
export function InsertsBeforeStatic() {
  return (
    <div class="panel">
      {show() ? (
        <>
          {item("a")}
          {item("b")}
          <label>static</label>
        </>
      ) : null}
    </div>
  );
}

export function InsertsAfterStatic() {
  return <div>{show() ? <><label>static</label>{item("a")}{item("b")}</> : null}</div>;
}

export function Interleaved() {
  return (
    <>
      <h1>Title</h1>
      {item("a")}
      <Card />
      <p>middle</p>
      {item("b")}
      <footer>end</footer>
    </>
  );
}

export function NestedFragments() {
  return (
    <div>
      {show() ? (
        <>
          {item("a")}
          <>
            <b>inner</b>
            {item("b")}
          </>
          <i>after</i>
        </>
      ) : null}
    </div>
  );
}

export function MapInFragment() {
  return (
    <div>
      {show() ? (
        <>
          {items().map((x) => <li>{x}</li>)}
          <label>after the list</label>
        </>
      ) : null}
    </div>
  );
}

export function TextAndInserts() {
  return (
    <div>
      {show() ? (
        <>
          Hello {name()}, you have {item("a")}
          <em>!</em>
        </>
      ) : null}
    </div>
  );
}

export function ChildrenTextAndInsert() {
  return <Card>Footer {name()}</Card>;
}

export function SingleInsert() {
  return <div>{show() ? <>{item("a")}</> : null}</div>;
}
