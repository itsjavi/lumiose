// Fragments: multi-root templates, mixed with dynamic items in an array of renderables.
import { signal } from "lumen";
import { Card } from "./Card.stsx";

export function Multi() {
  return (
    <>
      <h1>Title</h1>
      <p>Body</p>
    </>
  );
}

export function Mixed() {
  const count = signal(0);
  return (
    <>
      <h1>Count</h1>
      {count()}
      <Card />
      <p onClick={() => count.set(0)}>reset</p>
    </>
  );
}

export const Single = () => <><p>only</p></>;
export const Nothing = () => <></>;
export const TextOnly = () => <>Just text</>;

export function Nested() {
  return (
    <div>
      <>
        <span>a</span>
        <>{"b"}</>
      </>
    </div>
  );
}

export function TextAndDynamic() {
  const count = signal(0);
  return <Card>Footer {count()}</Card>;
}
