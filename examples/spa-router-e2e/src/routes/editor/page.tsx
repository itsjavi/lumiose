import { signal } from "lumiose";
import { beforeNavigate } from "lumiose/router";

// TASK-296: leaving unsaved changes asks first. Inside the SPA the page asks with confirm(); for a
// navigation that unloads the document the browser asks (beforeunload).
export default function EditorPage() {
  const dirty = signal(false);
  beforeNavigate((navigation) => {
    if (!dirty()) return;
    if (navigation.willUnload) navigation.cancel();
    else if (!confirm("Discard your changes?")) navigation.cancel();
  });
  return (
    <section>
      <h1 id="editor">Editor</h1>
      <textarea id="draft" onInput={() => dirty.set(true)} />
    </section>
  );
}
