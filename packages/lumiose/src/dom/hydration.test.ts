// @vitest-environment happy-dom
// The hydration hook point only (TASK-18 implements the cursor): with a hydrator installed,
// templates claim instead of cloning and regions adopt the existing nodes they are given.
import { afterEach, describe, expect, it } from "vitest";
import { flush, signal } from "../core/index.ts";
import { createOwner, runWithOwner } from "../core/internal.ts";
import { setHydrator, type Hydrator } from "./hydration.ts";
import { branch, insert, list, template } from "./index.ts";

afterEach(() => {
  setHydrator(undefined);
});

/** A fake cursor: templates claim from `claims` in order; regions adopt the nodes listed per marker. */
function fakeHydrator(claims: Node[], regions: Map<Node | null, Node[]>): Hydrator {
  return {
    template: () => claims.shift()!,
    region: (_parent, marker) => regions.get(marker) ?? [],
    block: () => false,
    end: () => {},
    branch: () => {},
    range: () => {},
    fork: () => {
      throw new Error("not used");
    },
  };
}

function inRoot(fn: () => void): void {
  runWithOwner(createOwner(undefined), fn);
}

describe("hydration hook", () => {
  it("templates claim existing nodes instead of cloning", () => {
    const server = document.createElement("div");
    server.innerHTML = "<p>server</p>";
    const tP = template(`<p>client`);
    setHydrator(fakeHydrator([server.firstChild!], new Map()));
    expect(tP()).toBe(server.firstChild);
    setHydrator(undefined);
    expect(tP().textContent).toBe("client");
  });

  it("insert adopts the region's nodes: text is reused, claimed nodes stay, the rest is removed", () => {
    const el = document.createElement("div");
    el.innerHTML = "a<b>claimed</b>stale<i>extra</i><!---->z";
    const [, b, stale, extra, marker] = Array.from(el.childNodes);
    const tB = template(`<b>`);
    const n = signal(1);
    setHydrator(fakeHydrator([b!], new Map([[marker!, [b!, stale!, extra!]]])));
    inRoot(() => insert(el, () => [tB(), `n${n()}`], marker));
    setHydrator(undefined);
    expect(el.innerHTML).toBe("a<b>claimed</b>n1<!---->z");
    expect(el.childNodes[1]).toBe(b);
    expect(el.childNodes[2]).toBe(stale);
    n.set(2);
    flush();
    expect(el.childNodes[2]).toBe(stale);
    expect(stale!.textContent).toBe("n2");
  });

  it("branch and list adopt their regions", () => {
    const el = document.createElement("ul");
    el.innerHTML = "<li>1</li><li>2</li><li>gone</li><!----><em>x</em><!---->";
    const [li1, li2, gone, listMarker, em, branchMarker] = Array.from(el.childNodes);
    const tLi = template(`<li> `);
    const tEm = template(`<em>`);
    const rows = signal([1, 2]);
    setHydrator(
      fakeHydrator(
        [li1!, li2!, em!],
        new Map([
          [listMarker!, [li1!, li2!, gone!]],
          [branchMarker!, [em!]],
        ]),
      ),
    );
    inRoot(() => {
      list(el, listMarker!, rows, () => tLi());
      branch(
        el,
        branchMarker!,
        () => true,
        () => tEm(),
      );
    });
    setHydrator(undefined);
    expect(Array.from(el.childNodes)).toEqual([li1, li2, listMarker, em, branchMarker]);
    expect(gone!.isConnected).toBe(false);
    rows.set([2]);
    flush();
    expect(Array.from(el.childNodes)).toEqual([li2, listMarker, em, branchMarker]);
  });
});
