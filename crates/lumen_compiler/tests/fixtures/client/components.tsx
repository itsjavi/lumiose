// Component calls: getter props for reactive reads and JSX, plain values for literals,
// identifiers and functions, a lazy children getter, spreads through mergeProps.
import { signal } from "lumen";
import { Card, ui } from "./ui.stsx";

export function App({ Icon, extra }: { Icon: (p: object) => unknown; extra: object }) {
  const user = signal({ name: "Ada" });
  const handler = () => user.set({ name: "Bob" });
  const size = 3;
  return (
    <div>
      <Card title="Static" count={1} enabled flag={false} onSelect={handler} size={size} />
      <Card title={user().name} key="k" client:load>
        Hello <b>{user().name}</b>
      </Card>
      <Card>{user().name}</Card>
      <Card>Text only</Card>
      <Card><p>Element only</p></Card>
      <Card icon={<Icon />} render={() => <i>row</i>} />
      <Card {...extra} title="after" {...{ a: 1 }} />
      <ui.Panel.Header level={2} />
      <Icon size={16} />
    </div>
  );
}

export const Wrapper = (props: { children?: unknown }) => <Card>{props.children}</Card>;
