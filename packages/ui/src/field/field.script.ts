// Field's client script (decision-62, decision-63): it shows the browser's constraint validation in
// the fields' own Error parts, after Base UI and doc-9 section 15. The controls are native (or
// form-associated), so `required`, `type`, `pattern`, `minlength` and the rest, the `:invalid`
// state and the form's blocked submission are the platform's; without JavaScript the browser
// reports the first problem in its own bubble. Where this script runs, for every `lu-field` on
// the page:
//
// - A submit attempt fires `invalid` on each invalid control: a field with an Error part cancels
//   it (no bubble) and shows the problem there, and focus goes to the first invalid control of
//   the form, in DOM order; a later invalid control without a field shows no bubble meanwhile.
//   Only a submit attempt does: a submit button's click, Enter in a field, `requestSubmit()` or
//   the form's `reportValidity()`. A silent `checkValidity()` shows nothing (TASK-439).
// - A form action's errors move focus to the first field that shows one: on load, or when an
//   island's errors arrive (TASK-439).
// - Timing, from the field's `validation-mode`: `onSubmit` (default) shows errors after a submit
//   attempt, `onBlur` also when the control loses focus (a missing value only once it was
//   edited), `onChange` as soon as it is edited. Once shown, the field revalidates as you type.
// - An Error without children (an `<output for>` the control) shows the browser's message (or the
//   one a `validate` function set); an Error with children shows them. Either shows for any
//   problem, always, or only for its `match` (a `ValidityState` key, read from its id).
// - Server errors (rendered visible from the Form's `errors`) go away once the value changes.
// - A `validitychange` event on a control (Field.Root fires it when an async `validate` settles)
//   shows its new verdict, if the field shows its errors by then. On the field itself, with the
//   messages, it brings a form action's errors back, also the same ones after an edit hid them.
// - The control gets `aria-invalid` and `aria-describedby` for the errors shown and the field's
//   descriptions.
//
// It must not import `lumiose`: server-rendered pages load it without the runtime.

type Control = HTMLElement & {
  validity: ValidityState;
  validationMessage: string;
  willValidate: boolean;
  form: HTMLFormElement | null;
};

const CONTROL = "input, select, textarea, lu-combobox";
/** Fields whose errors are on view: after a submit attempt, a blur or an edit (per mode). */
const shown = new WeakSet<HTMLElement>();
/** Fields that still show the errors the server rendered: until the value changes. */
const server = new WeakMap<HTMLElement, boolean>();
/** Controls that lost focus once. */
const touched = new WeakSet<Element>();
/** A pending focus move to the first invalid control of a form. */
let focusing = false;
/**
 * The form whose submission is being attempted: set by a submit button's click or Enter in a
 * field until the next task (the browser validates within it), and during `requestSubmit()` and
 * `reportValidity()`. `invalid` events outside an attempt (`checkValidity()`) change nothing.
 */
let attempt: HTMLFormElement | null = null;

const fieldOf = (node: EventTarget | null) =>
  node instanceof Element ? node.closest<HTMLElement>("lu-field") : null;

function controls(field: HTMLElement): Control[] {
  return [...field.querySelectorAll<Control>(CONTROL)].filter(
    (control) =>
      fieldOf(control) === field &&
      // An Autocomplete's element (`free`) submits nothing: its input is the control.
      !(control.localName === "lu-combobox" && control.hasAttribute("free")) &&
      control.willValidate !== undefined &&
      !/^(submit|reset|button|image|hidden)$/.test((control as HTMLInputElement).type ?? ""),
  );
}

/**
 * The field's Error parts: `<id>-error` (the message), `<id>-error-invalid` (any problem),
 * `<id>-error-always`, and `<id>-error-<ValidityState key>`.
 */
function errors(field: HTMLElement): HTMLElement[] {
  return [
    ...field.querySelectorAll<HTMLElement>(`[id^="${CSS.escape(`${field.id}-error`)}"]`),
  ].filter((error) => fieldOf(error) === field);
}

/** What an Error part shows for: "" (any problem), "always", or a `ValidityState` key. */
const matchOf = (field: HTMLElement, error: HTMLElement) =>
  error.id.slice(`${field.id}-error`.length + 1);

function dirty(control: Control): boolean {
  if (control instanceof HTMLInputElement && /^(checkbox|radio)$/.test(control.type)) {
    return control.checked !== control.defaultChecked;
  }
  if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
    return control.value !== control.defaultValue;
  }
  return true;
}

/**
 * Puts `message` in an `<output>` Error: into its text node, which Lumiose renders and updates with
 * the next server error in an island, or a new one.
 */
function write(output: HTMLElement, message: string): void {
  const text = [...output.childNodes].find((node): node is Text => node.nodeType === 3);
  if (text) text.data = message;
  else output.append(message);
}

/** Writes the field's errors, `aria-invalid` and `aria-describedby` from its controls' validity. */
function render(field: HTMLElement): void {
  const all = controls(field);
  const invalid = shown.has(field) ? all.find((control) => !control.validity.valid) : undefined;
  const fromServer = server.get(field) === true;
  const visible: string[] = [];
  for (const error of errors(field)) {
    const match = matchOf(field, error);
    let show: boolean;
    if (match === "always") show = true;
    else if (invalid) {
      show =
        match === "" ||
        match === "invalid" ||
        invalid.validity[match as keyof ValidityState] === true;
      // A message Error is `for` the control; one with children keeps them.
      if (show && error.hasAttribute("for")) write(error, invalid.validationMessage);
    } else show = fromServer && !error.hidden;
    error.hidden = !show;
    if (show) visible.push(error.id);
  }
  const descriptions = [
    ...field.querySelectorAll<HTMLElement>(`[id="${CSS.escape(`${field.id}-description`)}"]`),
  ].map((description) => description.id);
  const done = new Set<Element>();
  for (const control of all) {
    const bad = (invalid !== undefined && !control.validity.valid) || fromServer;
    // A radio or checkbox group is described and marked as one; lu-combobox through its input.
    const group = control.closest<HTMLElement>("[role=radiogroup], [role=group]");
    const target =
      control.localName === "lu-combobox"
        ? (control.querySelector<HTMLElement>("input[role=combobox]") ?? control)
        : group && fieldOf(group) === field
          ? group
          : control;
    if (done.has(target)) continue;
    done.add(target);
    if (bad) target.setAttribute("aria-invalid", "true");
    else target.removeAttribute("aria-invalid");
    const ids = [...descriptions, ...visible];
    if (ids.length > 0) target.setAttribute("aria-describedby", ids.join(" "));
    else target.removeAttribute("aria-describedby");
  }
}

/** Takes a field over the first time the script meets it: its server errors and descriptions. */
function meet(field: HTMLElement): void {
  if (server.has(field)) return;
  server.set(
    field,
    errors(field).some((error) => !error.hidden && matchOf(field, error) !== "always"),
  );
  render(field);
}

function on<K extends keyof DocumentEventMap>(
  type: K,
  listener: (event: DocumentEventMap[K]) => void,
  capture = true,
) {
  document.addEventListener(type, listener, capture);
}

function attempting(form: HTMLFormElement | null | undefined): void {
  if (!form) return;
  attempt = form;
  setTimeout(() => {
    if (attempt === form) attempt = null;
  });
}

on("click", (event) => {
  const button = (event.target as Element).closest?.<HTMLButtonElement | HTMLInputElement>(
    "button, input[type=submit], input[type=image]",
  );
  if (button && /^(submit|image)$/.test(button.type)) attempting(button.form);
});

on("keydown", (event) => {
  const target = event.target as HTMLInputElement;
  // Implicit submission: Enter in a text field submits its form.
  if (event.key === "Enter" && target instanceof HTMLInputElement) attempting(target.form);
});

for (const name of ["requestSubmit", "reportValidity"] as const) {
  const native = HTMLFormElement.prototype[name] as (
    this: HTMLFormElement,
    ...args: never[]
  ) => never;
  Object.defineProperty(HTMLFormElement.prototype, name, {
    configurable: true,
    writable: true,
    value(this: HTMLFormElement, ...args: never[]) {
      const outer = attempt;
      attempt = this;
      try {
        return native.apply(this, args);
      } finally {
        attempt = outer;
      }
    },
  });
}

/** Whether a field with an Error part shows `control`'s problems. */
const handled = (control: Element) => {
  const field = fieldOf(control);
  return field !== null && errors(field).length > 0;
};

/** The control focus goes to: lu-combobox's input, or the control. */
const focusTarget = (control: Element) =>
  control.localName === "lu-combobox"
    ? (control.querySelector<HTMLElement>("input[role=combobox]") ?? (control as HTMLElement))
    : (control as HTMLElement);

const firstInvalid = (form: HTMLFormElement) =>
  [...(form.elements as unknown as Control[])].find(
    (element) => element.willValidate && !element.validity.valid,
  );

// `invalid` does not bubble: a capturing listener sees it.
on("invalid", (event) => {
  const control = event.target as Control;
  const form = control.form;
  if (!form || attempt !== form) return;
  const field = fieldOf(control);
  if (!field || errors(field).length === 0) {
    // A later control without a field: no bubble while focus goes to the first, a field's.
    const first = firstInvalid(form);
    if (first && first !== control && handled(first)) event.preventDefault();
    return;
  }
  meet(field);
  // The field shows the problem: no bubble from the browser.
  event.preventDefault();
  shown.add(field);
  render(field);
  if (focusing) return;
  focusing = true;
  queueMicrotask(() => {
    focusing = false;
    const first = firstInvalid(form);
    if (first && handled(first) && document.activeElement !== focusTarget(first)) {
      focusTarget(first).focus();
    }
  });
});

/** Fields that just got a form action's errors, for one focus move after them. */
const arrived = new Set<HTMLElement>();

/** Focuses the first control, in document order, of `fields`. */
function focusFirst(fields: Iterable<HTMLElement>): void {
  const first = [...fields]
    .flatMap((field) => controls(field).slice(0, 1))
    .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))[0];
  if (first) focusTarget(first).focus();
}

on("focusout", (event) => {
  const control = event.target as Control;
  const field = fieldOf(control);
  if (!field || !control.matches?.(CONTROL)) return;
  meet(field);
  touched.add(control);
  const mode = field.getAttribute("validation-mode") ?? "onSubmit";
  if (mode === "onSubmit" || control.validity?.valid !== false) return;
  // A missing value waits until the field was edited, as in Base UI.
  if (control.validity.valueMissing && !dirty(control)) return;
  shown.add(field);
  render(field);
});

function onEdit(event: Event) {
  const field = fieldOf(event.target);
  if (!field) return;
  meet(field);
  // A new value: the server's verdict no longer applies.
  server.set(field, false);
  if (field.getAttribute("validation-mode") === "onChange") shown.add(field);
  render(field);
}

/** A form action's errors for the field (an island's Field.Root): shown as the server's again. */
function showServerErrors(field: HTMLElement, messages: string[]): void {
  server.set(field, true);
  for (const error of errors(field)) {
    const match = matchOf(field, error);
    if (match !== "" && match !== "invalid") continue;
    error.hidden = false;
    if (error.hasAttribute("for")) write(error, messages.join(" "));
  }
}

// Not bubbling: a capturing listener sees it.
document.addEventListener(
  "validitychange",
  (event) => {
    const field = fieldOf(event.target);
    if (!field) return;
    meet(field);
    const detail = (event as CustomEvent<{ errors?: string[] } | null>).detail;
    if (event.target === field && detail?.errors) {
      showServerErrors(field, detail.errors);
      if (arrived.size === 0) {
        queueMicrotask(() => {
          focusFirst(arrived);
          arrived.clear();
        });
      }
      arrived.add(field);
    }
    render(field);
  },
  true,
);

// After the component's own listeners, which run a `validate` function first.
on("input", onEdit, false);
on("change", onEdit, false);
on("reset", (event) => {
  const form = event.target as HTMLFormElement;
  // The controls take their default values after the event.
  queueMicrotask(() => {
    for (const field of form.querySelectorAll<HTMLElement>("lu-field")) {
      shown.delete(field);
      server.set(field, false);
      render(field);
    }
  });
});

function meetAll() {
  const fields = [...document.querySelectorAll<HTMLElement>("lu-field")];
  for (const field of fields) meet(field);
  // A page rendered back with a form action's errors: focus goes to the first, unless something
  // else (`autofocus`) has it.
  if (document.activeElement === document.body || document.activeElement === null) {
    focusFirst(fields.filter((field) => server.get(field) === true));
  }
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", meetAll, { once: true });
} else queueMicrotask(meetAll);
