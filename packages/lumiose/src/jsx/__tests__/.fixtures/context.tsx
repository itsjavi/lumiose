// `<Ctx value>` providers and `useContext` (TASK-191.1, decision-35).
import { createContext, signal, useContext, type Signal } from "lumiose";

const Theme = createContext("light");
const User = createContext<{ name: string } | undefined>();
const Count = createContext<Signal<number>>(signal(0));

function Label() {
  const theme: string = useContext(Theme);
  const user: { name: string } | undefined = useContext(User);
  return (
    <p>
      {theme} {user?.name} {useContext(Count)()}
    </p>
  );
}

export const accepted = [
  <Theme value="dark">
    <Label />
  </Theme>,
  <Theme value="dark">
    <User value={{ name: "Ada" }}>
      <Label />
      <Label />
    </User>
  </Theme>,
  <User value={undefined}>text</User>,
  <Count value={signal(1)}>{() => <Label />}</Count>,
  <Theme value="dark" />,
];

export const rejected = [
  // @ts-expect-error the value must match the context's type.
  <Theme value={1}>
    <Label />
  </Theme>,
  // @ts-expect-error `value` is required.
  <Theme>
    <Label />
  </Theme>,
  // @ts-expect-error children must be renderable.
  <Theme value="dark">{{ a: 1 }}</Theme>,
];
