// Lumiose's keyed js-framework-benchmark app, hand-compiled (krausest `lumiose-hand`).
//
// The output the compiler should emit for the component below, written by hand from the
// compiler-runtime contract (doc-2 §2 and the golden examples in §5.2 and §5.4): hoisted templates
// and apply functions, a hoisted selector, delegated events with data slots, a signal passed
// directly as a binding source, and one-time writes for plain values (`id` is a const read from
// row data). It is the reference for the compiled App.stsx (krausest `lumiose`); RESULTS.md compares
// both.
//
//   import { signal } from "lumiose";
//
//   const data = signal<Row[]>([]);
//   const selected = signal(0);
//   // run, runLots, add, update, clear, swapRows, select and remove are defined below.
//
//   export function App() {
//     return (
//       <div class="container">
//         <div class="jumbotron">
//           <div class="row">
//             <div class="col-md-6"><h1>Lumiose</h1></div>
//             <div class="col-md-6">
//               <div class="row">
//                 <div class="col-sm-6 smallpad">
//                   <button type="button" class="btn btn-primary btn-block" id="run" onClick={run}>
//                     Create 1,000 rows
//                   </button>
//                 </div>
//                 … the same for runlots, add, update, clear and swaprows …
//               </div>
//             </div>
//           </div>
//         </div>
//         <table class="table table-hover table-striped test-data">
//           <tbody>
//             {data().map((row) => {
//               const id = row.id;
//               return (
//                 <tr class={{ danger: selected() === id }}>
//                   <td class="col-md-1">{id}</td>
//                   <td class="col-md-4"><a onClick={() => select(id)}>{row.label()}</a></td>
//                   <td class="col-md-1">
//                     <a onClick={() => remove(id)}>
//                       <span class="glyphicon glyphicon-remove" aria-hidden="true" />
//                     </a>
//                   </td>
//                   <td class="col-md-6" />
//                 </tr>
//               );
//             })}
//           </tbody>
//         </table>
//         <span class="preloadicon glyphicon glyphicon-remove" aria-hidden="true" />
//       </div>
//     );
//   }
//
//   render(() => <App />, document.getElementById("main")!);

/* eslint-disable no-underscore-dangle -- compiled names (_t0, _el, …) follow the compiler's output */
import { signal } from "lumiose";
import {
  bind,
  createComponent,
  delegateEvents,
  list,
  render,
  selector,
  setText,
  template,
  toggleClass,
} from "lumiose/dom";

// ---- compiled templates and hoisted functions --------------------------------------------------

const _t0 = /* @__PURE__ */ template(
  `<tr><td class=col-md-1> <td class=col-md-4><a> </a><td class=col-md-1><a><span class="glyphicon glyphicon-remove" aria-hidden=true></span></a><td class=col-md-6>`,
);
const _t1 = /* @__PURE__ */ template(
  `<div class=container><div class=jumbotron><div class=row><div class=col-md-6><h1>Lumiose</h1></div><div class=col-md-6><div class=row><div class="col-sm-6 smallpad"><button type=button class="btn btn-primary btn-block" id=run>Create 1,000 rows</button></div><div class="col-sm-6 smallpad"><button type=button class="btn btn-primary btn-block" id=runlots>Create 10,000 rows</button></div><div class="col-sm-6 smallpad"><button type=button class="btn btn-primary btn-block" id=add>Append 1,000 rows</button></div><div class="col-sm-6 smallpad"><button type=button class="btn btn-primary btn-block" id=update>Update every 10th row</button></div><div class="col-sm-6 smallpad"><button type=button class="btn btn-primary btn-block" id=clear>Clear</button></div><div class="col-sm-6 smallpad"><button type=button class="btn btn-primary btn-block" id=swaprows>Swap Rows</button></div></div></div></div></div><table class="table table-hover table-striped test-data"><tbody></tbody></table><span class="preloadicon glyphicon glyphicon-remove" aria-hidden=true></span></div>`,
);
const _a0 = (el, v) => toggleClass(el, "danger", v);
// `onClick={() => select(id)}` captures only row data: one shared handler plus a data slot.
const _onClick = (id) => select(id);
const _onClick2 = (id) => remove(id);

// ---- user code (unchanged by the compiler) ------------------------------------------------------

const adjectives = ["pretty", "large", "big", "small", "tall", "short", "long", "handsome", "plain", "quaint", "clean", "elegant", "easy", "angry", "crazy", "helpful", "mushy", "odd", "unsightly", "adorable", "important", "inexpensive", "cheap", "expensive", "fancy"]; // prettier-ignore
const colors = ["red", "yellow", "blue", "green", "pink", "brown", "purple", "brown", "white", "black", "orange"]; // prettier-ignore
const nouns = ["table", "chair", "house", "bbq", "desk", "car", "pony", "cookie", "sandwich", "burger", "pizza", "mouse", "keyboard"]; // prettier-ignore

const random = (max) => Math.round(Math.random() * 1000) % max;

let nextId = 1;

function buildData(count) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      id: nextId++,
      label: signal(
        `${adjectives[random(adjectives.length)]} ${colors[random(colors.length)]} ${nouns[random(nouns.length)]}`,
      ),
    });
  }
  return rows;
}

const data = signal([]);
const selected = signal(0);

// Delegated handlers batch their writes, so none of these needs `batch()`.
const run = () => data.set(buildData(1000));
const runLots = () => data.set(buildData(10000));
const add = () => data.set(data().concat(buildData(1000)));
const update = () => {
  const rows = data();
  for (let i = 0; i < rows.length; i += 10) {
    rows[i].label.update((label) => label + " !!!");
  }
};
const clear = () => data.set([]);
const swapRows = () => {
  const rows = data().slice();
  if (rows.length > 998) {
    const row = rows[1];
    rows[1] = rows[998];
    rows[998] = row;
    data.set(rows);
  }
};
const select = (id) => selected.set(id);
const remove = (id) => {
  const rows = data();
  data.set(
    rows.toSpliced(
      rows.findIndex((row) => row.id === id),
      1,
    ),
  );
};

// ---- compiled component --------------------------------------------------------------------------

export function App() {
  const _el = _t1(),
    _div = _el.firstChild,
    _div2 = _div.firstChild.firstChild.nextSibling.firstChild,
    _div3 = _div2.firstChild,
    _button = _div3.firstChild,
    _div4 = _div3.nextSibling,
    _button2 = _div4.firstChild,
    _div5 = _div4.nextSibling,
    _button3 = _div5.firstChild,
    _div6 = _div5.nextSibling,
    _button4 = _div6.firstChild,
    _div7 = _div6.nextSibling,
    _button5 = _div7.firstChild,
    _button6 = _div7.nextSibling.firstChild,
    _tbody = _div.nextSibling.firstChild;
  _button.$$click = run;
  _button2.$$click = runLots;
  _button3.$$click = add;
  _button4.$$click = update;
  _button5.$$click = clear;
  _button6.$$click = swapRows;
  const _isSelected = selector(selected);
  list(_tbody, null, data, (row) => {
    const id = row.id;
    const _el2 = _t0(),
      _td = _el2.firstChild,
      _td2 = _td.nextSibling,
      _a = _td2.firstChild,
      _a2 = _td2.nextSibling.firstChild;
    bind(_el2, () => _isSelected(id), _a0);
    _td.firstChild.data = id;
    _a.$$click = _onClick;
    _a.$$clickData = id;
    bind(_a.firstChild, row.label, setText);
    _a2.$$click = _onClick2;
    _a2.$$clickData = id;
    return _el2;
  });
  return _el;
}
delegateEvents(["click"]);

render(() => createComponent(App, {}), document.getElementById("main"));
