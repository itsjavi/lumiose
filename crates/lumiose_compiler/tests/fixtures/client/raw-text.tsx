// `<script>` and `<style>` content is raw text, which HTML does not decode (TASK-472 L7): static
// text is written as it is, with `</script`, `</style` and `<!--` neutralized; in a JSON script
// every `<` is `\u003c`. On the server, dynamic text, `innerHTML` and `textContent` go through
// `rawText()`; the client writes DOM text. Mixed text and values are one text. In SVG, `<style>`
// text is escaped as usual.
export function JsonLd(props: { data: object }) {
  return (
    <div>
      <script type="application/ld+json">{JSON.stringify(props.data)}</script>
      <script type="application/ld+json" innerHTML={JSON.stringify(props.data)} />
      <script type="importmap">{'{"imports": {"a": "./a.js?x=1&y=<2"}}'}</script>
    </div>
  );
}

export function Inline(props: { name: string; css: string }) {
  return (
    <div>
      <script>{"if (1 < 2 && ok) document.title = '</script>';"}</script>
      <script>
        var name = {JSON.stringify(props.name)};
      </script>
      <style>{props.css}</style>
      <style>{"a > b::after { content: '</style>' }"}</style>
      <script textContent={props.name} />
      <svg>
        <style>{"a < b"}</style>
      </svg>
    </div>
  );
}

// TASK-495: a `<style>` or `<script>` under a root such as `<g>` or `<mi>` is SVG or MathML, as on
// the client: its text is escaped (and the parser decodes it). A root `<style>` or `<script>` may
// still end up inside `<svg>`, where its text is parsed as markup: `rawText()` escapes the
// character after each `<` that could open a tag, as in the static text here.
export function Layer(props: { css: string }) {
  return (
    <g>
      <style>{props.css}</style>
    </g>
  );
}

export function Formula(props: { code: string }) {
  return (
    <>
      <mi>x</mi>
      <script>{props.code}</script>
    </>
  );
}

export function Sheet(props: { css: string }) {
  return (
    <>
      <style>{props.css}</style>
      <style>{"a::after { content: '<img src=x>' }"}</style>
    </>
  );
}
