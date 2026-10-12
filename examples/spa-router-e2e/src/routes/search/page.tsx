import { searchParams } from "lumiose/router";

const q = () => searchParams().get("q") ?? "";

export default function SearchPage() {
  return (
    <section>
      <p id="q">q={q()}</p>
      <button id="more" onClick={() => searchParams.set({ q: `${q()}b` })}>
        more
      </button>
    </section>
  );
}
