// Component call props (TASK-78, contract doc-2 §3.1): literal children are data properties on
// both targets; on the server, trivially safe expressions (local identifiers, single-level
// `props.x`, template literals of those) are data properties too. Everything else stays a lazy
// getter, so nothing runs earlier than on the client.
import { signal } from "lumen";
import { Badge, Detail } from "./ui.tsx";

export function Page(props: { title: string; user?: { name: string }; tone: string }) {
  const user = signal(props.user);
  const size = 2;
  return (
    <main>
      <Badge kind="ok">active</Badge>
      <Badge kind="count">{42}</Badge>
      <Detail
        title={props.title}
        size={size}
        label={`${props.tone}-${size}`}
        name={user()!.name}
        deep={props.user.name}
        maybe={props.user?.name}
        show={user() != null}
        icon={<i>★</i>}
      >
        {props.title}
      </Detail>
    </main>
  );
}

export function Defaults({ tone = "plain", label }: { tone?: string; label: string }) {
  return <Badge kind={tone} label={label} />;
}
