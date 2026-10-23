import { signal } from "lumiose";
import { beforeNavigate } from "lumiose/router";

// TASK-296, TASK-549: leaving unsaved changes asks first. The page asks with confirm() for links,
// navigate() and back/forward, a link out of the SPA included; for "leave" (closing the tab, a
// reload) the browser asks (beforeunload).
export default function EditorPage() {
  const dirty = signal(false);
  beforeNavigate((navigation) => {
    if (!dirty()) return;
    if (navigation.type === "leave") navigation.cancel();
    else if (!confirm("Discard your changes?")) navigation.cancel();
  });
  return (
    <section>
      <h1 id="editor">Editor</h1>
      <textarea id="draft" onInput={() => dirty.set(true)} />
    </section>
  );
}
