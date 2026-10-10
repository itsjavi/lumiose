// Intrinsic elements: tags, attributes, class, style, ref, attach, innerHTML, key (spec §4.5).
import { ref, signal } from "./helpers.ts";

const active = signal(false);
const width = signal(50);
const inputRef = ref<HTMLInputElement>();
const elementRef = ref<HTMLElement>();
const circleRef = ref<SVGCircleElement>();
const current: HTMLInputElement | undefined = inputRef();

export const accepted = [
  <div id="main" class="card" />,
  <div class={["a", active() && "b", { c: active(), d: null }, [["e", undefined]]]} />,
  <div class={{ hot: width() > 5 }} />,
  <div style="color: red" />,
  <div
    style={{
      color: "red",
      "background-color": "blue",
      "--progress": width(),
      "-webkit-line-clamp": 2,
      float: "left",
      opacity: active() && 0.5,
    }}
  />,
  <label for="name">Name</label>,
  <meta http-equiv="refresh" content="5" />,
  <form accept-charset="utf-8" method="post" novalidate />,
  <input type="number" min={0} max="10" required placeholder="n" />,
  <a href="/x" target="_blank" rel="noopener" />,
  <table>
    <tr>
      <td colspan={2} />
    </tr>
  </table>,
  <button type="submit" disabled={active()} aria-pressed={active()} data-id={1} />,
  <div tabindex={-1} hidden={active()} draggable="true" spellcheck={false} />,
  <div innerHTML="<b>trusted</b>" />,
  <ul>
    {[1, 2].map((n) => (
      <li key={n}>{n}</li>
    ))}
  </ul>,
  <p>
    {width}
    {() => width() * 2}
    {null}
    {undefined}
    {false}
    {0n}
    text
  </p>,
  <>
    <span />
  </>,
  <input ref={inputRef} />,
  <input ref={elementRef} />,
  <svg>
    <circle ref={circleRef} />
  </svg>,
  current,
  <input ref={(el) => el.select()} />,
  <input ref={(el: HTMLElement) => el.focus()} />,
  <canvas
    attach={[
      (el) => {
        el.getContext("2d");
        return () => {};
      },
      active() && ((el) => void el.width),
      null,
    ]}
  />,
  <svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
    <circle cx={5} cy="5" r={4} stroke-width={2} fill="none" class="dot" />
    <a href="#x">
      <text x={1}>t</text>
    </a>
  </svg>,
  <math display="block">
    <mi>x</mi>
    <mo stretchy={false}>=</mo>
    <mn>1</mn>
  </math>,
  <my-widget foo="bar" count={3} class="w" onClick={(e) => e.currentTarget.tagName} />,
];

export const rejected = [
  // @ts-expect-error `className` is rejected: use `class`.
  <div className="card" />,
  // @ts-expect-error `htmlFor` is rejected: use `for`.
  <label htmlFor="name" />,
  // @ts-expect-error camelCase style keys are rejected: use kebab-case.
  <div style={{ backgroundColor: "red" }} />,
  // @ts-expect-error `<style>` is not an element in `.tsx`: style blocks belong in `.stsx`.
  <style>{".a { color: red }"}</style>,
  // @ts-expect-error unknown attribute.
  <div foo="bar" />,
  // @ts-expect-error unknown tag.
  <dvi />,
  // @ts-expect-error class record values are booleans.
  <div class={{ a: "yes" }} />,
  // @ts-expect-error class does not take numbers.
  <div class={1} />,
  // @ts-expect-error style values are strings or numbers.
  <div style={{ color: ["red"] }} />,
  // @ts-expect-error enumerated attribute values are checked.
  <input type="nope" />,
  // @ts-expect-error a ref callback typed for an input does not fit a div.
  <div ref={(el: HTMLInputElement) => el.select()} />,
  // @ts-expect-error a `ref<HTMLInputElement>()` does not fit a div.
  <div ref={inputRef} />,
  // @ts-expect-error a ref of an SVG element does not fit an HTML element.
  <div ref={circleRef} />,
  // @ts-expect-error reading a ref gives the element or undefined.
  ((element: HTMLInputElement) => element)(inputRef()),
  // @ts-expect-error attachments receive the element.
  <div attach={[(el: HTMLInputElement) => el.select()]} />,
  // @ts-expect-error attach takes an array.
  <div attach={(el: HTMLElement) => el.focus()} />,
  // @ts-expect-error `client:*` directives are for components only.
  <div client:load />,
  // @ts-expect-error children must be renderable.
  <div>{{ a: 1 }}</div>,
];
