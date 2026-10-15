// The "basic support" suite of Custom Elements Everywhere, ported to Lumiose (TASK-326). The
// assertions and weights are upstream's; elements are found by id. `flush()` applies pending
// updates, as `act()` does in React's suite.
/* oxlint-disable no-unused-expressions, no-shadow, unicorn/consistent-function-scoping -- upstream's suite, kept as written (chai property assertions) */
import { expect } from "chai";
import { flush } from "lumiose";
import { render } from "lumiose/dom";
import {
  ComponentWithChildren,
  ComponentWithChildrenRerender,
  ComponentWithDifferentViews,
  ComponentWithImperativeEvent,
  ComponentWithoutChildren,
  ComponentWithProperties,
} from "./components.tsx";

const wc = (): any => document.querySelector("#wc");

describe("basic support", function () {
  let dispose: (() => void) | undefined;
  afterEach(function () {
    dispose?.();
    document.body.innerHTML = "";
  });

  describe("no children", function () {
    it("can display a Custom Element with no children", function () {
      this.weight = 3;
      dispose = render(() => <ComponentWithoutChildren />, document.body);
      expect(wc()).to.exist;
    });
  });

  describe("with children", function () {
    function expectHasChildren(wc: any) {
      expect(wc).to.exist;
      let shadowRoot = wc.shadowRoot;
      let heading = shadowRoot.querySelector("h1");
      expect(heading).to.exist;
      expect(heading.textContent).to.eql("Test h1");
      let paragraph = shadowRoot.querySelector("p");
      expect(paragraph).to.exist;
      expect(paragraph.textContent).to.eql("Test p");
    }

    it("can display a Custom Element with children in a Shadow Root", function () {
      this.weight = 3;
      dispose = render(() => <ComponentWithChildren />, document.body);
      expectHasChildren(wc());
    });

    it("can display a Custom Element with children in a Shadow Root and pass in Light DOM children", async function () {
      this.weight = 3;
      dispose = render(() => <ComponentWithChildrenRerender />, document.body);
      await Promise.resolve();
      flush();
      expectHasChildren(wc());
      expect(wc().textContent.includes("2")).to.be.true;
    });

    it("can display a Custom Element with children in the Shadow DOM and handle hiding and showing the element", function () {
      this.weight = 3;
      let toggle!: () => void;
      dispose = render(
        () => <ComponentWithDifferentViews setToggle={(fn) => (toggle = fn)} />,
        document.body,
      );
      expectHasChildren(wc());
      toggle();
      flush();
      let dummy = document.querySelector("#dummy");
      expect(dummy).to.exist;
      expect(dummy!.textContent).to.eql("Dummy view");
      toggle();
      flush();
      expectHasChildren(wc());
    });
  });

  describe("attributes and properties", function () {
    it("will pass boolean data as either an attribute or a property", function () {
      this.weight = 3;
      dispose = render(() => <ComponentWithProperties />, document.body);
      let data = wc().bool || wc().hasAttribute("bool");
      expect(data).to.be.true;
    });

    it("will pass numeric data as either an attribute or a property", function () {
      this.weight = 3;
      dispose = render(() => <ComponentWithProperties />, document.body);
      let data = wc().num || wc().getAttribute("num");
      expect(parseInt(data, 10)).to.eql(42);
    });

    it("will pass string data as either an attribute or a property", function () {
      this.weight = 3;
      dispose = render(() => <ComponentWithProperties />, document.body);
      let data = wc().str || wc().getAttribute("str");
      expect(data).to.eql("Lumiose");
    });
  });

  describe("events", function () {
    it("can imperatively listen to a DOM event dispatched by a Custom Element", function () {
      this.weight = 3;
      dispose = render(() => <ComponentWithImperativeEvent />, document.body);
      let handled = document.querySelector("#handled")!;
      expect(handled.textContent).to.eql("false");
      wc().click();
      flush();
      expect(handled.textContent).to.eql("true");
    });
  });
});
