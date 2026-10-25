import "/src/react-attributes.stsx.css";
// @tsx className attribute default
// React with attribute markers: file-level, component-level and global blocks, `$name`
// constants, and an SVG block that stays.
import { useState } from "react";
import { palette, radius } from "./tokens.ts";

export function Counter({ label }: { label: string }) {
  const [count, setCount] = useState(0);
  return (
    <div data-lum-mc4s2taa="" data-lum-7xcggddt="" className="counter">
      
      <button data-lum-mc4s2taa="" data-lum-7xcggddt="" onClick={() => setCount((n) => n + 1)}>{label}</button>
      <output data-lum-mc4s2taa="" data-lum-7xcggddt="" className="value">{count}</output>
      <svg data-lum-mc4s2taa="" data-lum-7xcggddt="" viewBox="0 0 10 10">
        <style>{`circle { fill: red; }`}</style>
        <circle data-lum-mc4s2taa="" data-lum-7xcggddt="" cx="5" cy="5" r="4" />
      </svg>
    </div>
  );
}

export default function App() {
  return (
    <main data-lum-mc4s2taa="" className="page">
      <Counter label="+1" />
      {[1, 2].map((n) => <p data-lum-mc4s2taa="" key={n} className="row">{n}</p>)}
    </main>
  );
}





// --- diagnostics ---
// LUM3018 warning `$radius.lg` is a unitless number (`8`) where `border-radius` needs a length
