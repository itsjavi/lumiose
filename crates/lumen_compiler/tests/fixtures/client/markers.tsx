// Insertion markers: <!> only between text and text or before another dynamic part; a following
// static node is used as the marker otherwise; the last dynamic part appends.
import { signal } from "lumen";
import { Card } from "./Card.stsx";

export function Markers() {
  const a = signal("a");
  const b = signal("b");
  return (
    <div>
      <p>before {a()} after</p>
      <p>{a()}{b()}</p>
      <p>{a()} trailing text</p>
      <p><br />{a()}<br /></p>
      <p>leading {a()}</p>
      <p><Card />{b()}<Card /></p>
      <p>{a()}</p>
    </div>
  );
}
