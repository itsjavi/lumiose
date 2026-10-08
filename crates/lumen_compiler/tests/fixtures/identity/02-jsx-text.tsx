export function Article(props: { title: string }) {
  return (
    <article class="post">
      <h1>{props.title}</h1>
      <p>Don't panic. It's "fine", isn't it?</p>
      <p>
        Unbalanced quotes: ' and " and ` stay in text.
        Slashes too: // not a comment, /* not a comment */, and a/b/c.
      </p>
      <p>Entities: &lt;style&gt; &amp; &quot;quoted&quot; &#123;braces&#125;</p>
      <a href="https://example.com/path?query=1&amp;b='2'">link with 'quotes'</a>
      <input value='single "double" inside' disabled />
      <>
        Fragment text with apostrophe's and <strong>nested</strong> elements.
      </>
      <my-element some-attr="x" data-id={1}>custom element</my-element>
      <svg:rect width="1" />
      {/* a JSX comment with <style> inside */}
      {
        // a line comment with </style>
      }
      <p>Text with <code>{"<style>"}</code> and {'</style>'} in strings.</p>
    </article>
  );
}

export const Empty = () => <></>;
export const SelfClosing = () => <br />;
export const Spread = (props: Record<string, unknown>) => <div {...props} />;
export const Conditional = (props: { ok: boolean }) =>
  props.ok ? <span>yes</span> : <span>no</span>;
export const Logical = (props: { ok: boolean }) => props.ok && <span>it's ok</span>;
export const Nested = () => <div title={<b>not usual</b> ? "a" : "b"}>x</div>;
