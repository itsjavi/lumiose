// A form's own members, read through the prototypes (TASK-473, L9). A form element exposes its
// controls by name, ahead of its own properties: a control named `reportValidity` or
// `addEventListener` shadows the form's member of that name (DOM clobbering), and calling it
// throws. For island code; each client script keeps its own copy of what it needs (a shared
// module would be a chunk of its own).

/** Checks the form's controls and reports the problems, as a submit attempt does. */
export function reportValidity(form: HTMLFormElement): boolean {
  return HTMLFormElement.prototype.reportValidity.call(form);
}

/** Listens to `type` on the form; returns the function that stops listening. */
export function listenToForm(
  form: HTMLFormElement,
  type: string,
  listener: EventListener,
  capture = false,
): () => void {
  EventTarget.prototype.addEventListener.call(form, type, listener, capture);
  return () => EventTarget.prototype.removeEventListener.call(form, type, listener, capture);
}
