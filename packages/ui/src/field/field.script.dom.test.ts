// @vitest-environment happy-dom
// Field's script wraps the form's `requestSubmit()` and `reportValidity()`, which are submit
// attempts too (TASK-439). The wrappers are installed once per page and keep the native names; a
// method the browser lacks stays missing (TASK-473, L10). Submit attempts themselves need a real
// browser and are checked by examples/ui-e2e.
import { expect, it, vi } from "vitest";

it("wraps the form's methods once per page, by their names, and only those that exist", async () => {
  const prototype = HTMLFormElement.prototype as Partial<HTMLFormElement>;
  const native = prototype.reportValidity;
  const request = Object.getOwnPropertyDescriptor(HTMLFormElement.prototype, "requestSubmit");
  // A browser without `requestSubmit()`.
  delete prototype.requestSubmit;
  try {
    await import("./field.script.ts");
    expect("requestSubmit" in HTMLFormElement.prototype).toBe(false);
    const wrapped = HTMLFormElement.prototype.reportValidity;
    expect(wrapped).not.toBe(native);
    expect(wrapped.name).toBe("reportValidity");
    // A second copy of the script (HMR, two versions of the package) leaves the wrapper alone.
    vi.resetModules();
    await import("./field.script.ts");
    expect(HTMLFormElement.prototype.reportValidity).toBe(wrapped);
  } finally {
    if (request) Object.defineProperty(HTMLFormElement.prototype, "requestSubmit", request);
  }
});
