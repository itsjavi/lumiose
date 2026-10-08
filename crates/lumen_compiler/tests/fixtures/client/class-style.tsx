// class: strings, arrays and objects (static keys become per-key toggleClass bindings);
// style: strings and objects (per-key setStyleProperty).
import { signal } from "lumen";

export function Styled(props: { active: boolean; cls: string; style: Record<string, string> }) {
  const on = signal(false);
  const flag = true;
  return (
    <div>
      <p class="static" style="color: red; margin: 0" />
      <p class={["a", "b", ""]} />
      <p class={{ base: true, off: false, on: on(), flag, "two words": on() }} />
      <p class={{ base: true, active: props.active, flag }} />
      <p class={props.cls} />
      <p class={[props.cls, on() && "on"]} />
      <p style={{ color: "red", "font-size": 12, "--accent": on() ? "blue" : null, width: flag }} />
      <p style={props.style} />
      <p style={`color: ${props.cls}`} />
    </div>
  );
}
