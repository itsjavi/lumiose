// A written `innerHTML` or `textContent` next to a spread applies as written, after the spread,
// on both targets (TASK-478): a spread never writes content (TASK-470), so it cannot go through
// it. It replaces the spread's `children` (TASK-347), as it replaces written children.
export function Html({ html, ...rest }: { html: string; [key: string]: unknown }) {
  return <div {...rest} innerHTML={html} />;
}

export function Text(props: { text: string; attrs: object }) {
  return (
    <section>
      <p {...props.attrs} textContent={props.text} />
      <p textContent="static" {...props.attrs} />
      <article innerHTML="<b>static</b>" {...props.attrs} />
    </section>
  );
}
