// Keyed js-framework-benchmark implementation for remix/component 1.0 (remix@3.0.0).
//
// Written the way Remix's component docs and the Remix team's own benchmark app
// (remix-run/remix packages/component/bench/frameworks/remix) write components: setup runs once,
// state lives in plain variables, event handlers mutate it and call `handle.update()`, and the
// render function returns the whole tree, rows included, with `on()` mixins for events. Remix
// has no memoization or fine-grained bindings: every update re-renders `App` and the runtime diffs
// the keyed row vnodes against the DOM.
import { createRoot, on } from "remix/component";

const random = (max) => Math.round(Math.random() * 1000) % max;

const A = [
  "pretty",
  "large",
  "big",
  "small",
  "tall",
  "short",
  "long",
  "handsome",
  "plain",
  "quaint",
  "clean",
  "elegant",
  "easy",
  "angry",
  "crazy",
  "helpful",
  "mushy",
  "odd",
  "unsightly",
  "adorable",
  "important",
  "inexpensive",
  "cheap",
  "expensive",
  "fancy",
];
const C = [
  "red",
  "yellow",
  "blue",
  "green",
  "pink",
  "brown",
  "purple",
  "brown",
  "white",
  "black",
  "orange",
];
const N = [
  "table",
  "chair",
  "house",
  "bbq",
  "desk",
  "car",
  "pony",
  "cookie",
  "sandwich",
  "burger",
  "pizza",
  "mouse",
  "keyboard",
];

let nextId = 1;

function buildData(count) {
  const data = [];
  for (let i = 0; i < count; i++) {
    data.push({
      id: nextId++,
      label: `${A[random(A.length)]} ${C[random(C.length)]} ${N[random(N.length)]}`,
    });
  }
  return data;
}

function Button(handle) {
  return () => (
    <div class="col-sm-6 smallpad">
      <button
        id={handle.props.id}
        class="btn btn-primary btn-block"
        type="button"
        mix={[on("click", handle.props.fn)]}
      >
        {handle.props.text}
      </button>
    </div>
  );
}

function App(handle) {
  let rows = [];
  let selected = 0;

  const run = () => {
    rows = buildData(1000);
    selected = 0;
    handle.update();
  };
  const runLots = () => {
    rows = buildData(10000);
    selected = 0;
    handle.update();
  };
  const add = () => {
    rows = rows.concat(buildData(1000));
    handle.update();
  };
  const update = () => {
    for (let i = 0; i < rows.length; i += 10) {
      rows[i].label += " !!!";
    }
    handle.update();
  };
  const clear = () => {
    rows = [];
    selected = 0;
    handle.update();
  };
  const swapRows = () => {
    if (rows.length > 998) {
      const row = rows[1];
      rows[1] = rows[998];
      rows[998] = row;
    }
    handle.update();
  };
  const select = (id) => {
    selected = id;
    handle.update();
  };
  const remove = (id) => {
    rows.splice(
      rows.findIndex((row) => row.id === id),
      1,
    );
    handle.update();
  };

  return () => (
    <div class="container">
      <div class="jumbotron">
        <div class="row">
          <div class="col-md-6">
            <h1>Remix 3 keyed</h1>
          </div>
          <div class="col-md-6">
            <div class="row">
              <Button id="run" text="Create 1,000 rows" fn={run} />
              <Button id="runlots" text="Create 10,000 rows" fn={runLots} />
              <Button id="add" text="Append 1,000 rows" fn={add} />
              <Button id="update" text="Update every 10th row" fn={update} />
              <Button id="clear" text="Clear" fn={clear} />
              <Button id="swaprows" text="Swap Rows" fn={swapRows} />
            </div>
          </div>
        </div>
      </div>
      <table class="table table-hover table-striped test-data">
        <tbody>
          {rows.map((row) => {
            const id = row.id;
            return (
              <tr key={id} class={selected === id ? "danger" : undefined}>
                <td class="col-md-1">{id}</td>
                <td class="col-md-4">
                  <a mix={[on("click", () => select(id))]}>{row.label}</a>
                </td>
                <td class="col-md-1">
                  <a mix={[on("click", () => remove(id))]}>
                    <span class="glyphicon glyphicon-remove" aria-hidden="true" />
                  </a>
                </td>
                <td class="col-md-6" />
              </tr>
            );
          })}
        </tbody>
      </table>
      <span class="preloadicon glyphicon glyphicon-remove" aria-hidden="true" />
    </div>
  );
}

createRoot(document.getElementById("main")).render(<App />);
