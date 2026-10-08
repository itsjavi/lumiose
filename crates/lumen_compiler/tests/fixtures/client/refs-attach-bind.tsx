// ref, attach, two-way bindings and innerHTML.
import { signal, ref } from "lumen";

const focus = (el: Element) => (el as HTMLElement).focus();

export function Form(props: { tooltip: (el: Element) => () => void }) {
  const name = signal("");
  const agree = signal(false);
  const input = ref<HTMLInputElement>();
  const html = signal("<b>x</b>");
  return (
    <form>
      <input ref={input} bind:value={name} attach={[focus, props.tooltip, agree() && focus]} />
      <input type="checkbox" bind:checked={agree} attach={focus} />
      <div innerHTML={html()} />
      <div innerHTML="<i>static</i>">ignored child</div>
    </form>
  );
}
