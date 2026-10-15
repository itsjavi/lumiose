// The "advanced support" suite of Custom Elements Everywhere, ported to Lumiose (TASK-326), with
// upstream's assertions and weights.
/* oxlint-disable no-unused-expressions, no-shadow, unicorn/consistent-function-scoping -- upstream's suite, kept as written (chai property assertions) */
import { expect } from "chai";
import { flush } from "lumiose";
import { render } from "lumiose/dom";
import { ComponentWithDeclarativeEvent, ComponentWithProperties } from "./components.tsx";

const wc = (): any => document.querySelector("#wc");

describe("advanced support", function () {
  let dispose: (() => void) | undefined;
  afterEach(function () {
    dispose?.();
    document.body.innerHTML = "";
  });

  describe("attributes and properties", function () {
    it("will pass array data as a property", function () {
      this.weight = 2;
      dispose = render(() => <ComponentWithProperties />, document.body);
      let data = wc().arr;
      expect(data).to.eql(["L", "u", "m", "i", "o", "s", "e"]);
    });

    it("will pass object data as a property", function () {
      this.weight = 2;
      dispose = render(() => <ComponentWithProperties />, document.body);
      let data = wc().obj;
      expect(data).to.eql({ org: "itsjavi", repo: "lumiose" });
    });

    it("will pass object data to a camelCase-named property", function () {
      this.weight = 2;
      dispose = render(() => <ComponentWithProperties />, document.body);
      let data = wc().camelCaseObj;
      expect(data).to.eql({ label: "passed" });
    });
  });

  describe("events", function () {
    function declarative(id: string) {
      dispose = render(() => <ComponentWithDeclarativeEvent />, document.body);
      let handled = document.querySelector(id)!;
      expect(handled.textContent).to.eql("false");
      wc().click();
      flush();
      expect(handled.textContent).to.eql("true");
    }

    it("can declaratively listen to a lowercase DOM event dispatched by a Custom Element", function () {
      this.weight = 2;
      declarative("#lowercase");
    });

    it("can declaratively listen to a kebab-case DOM event dispatched by a Custom Element", function () {
      this.weight = 1;
      declarative("#kebab");
    });

    it("can declaratively listen to a camelCase DOM event dispatched by a Custom Element", function () {
      this.weight = 1;
      declarative("#camel");
    });

    it("can declaratively listen to a CAPScase DOM event dispatched by a Custom Element", function () {
      this.weight = 1;
      declarative("#caps");
    });

    it("can declaratively listen to a PascalCase DOM event dispatched by a Custom Element", function () {
      this.weight = 1;
      declarative("#pascal");
    });
  });
});
