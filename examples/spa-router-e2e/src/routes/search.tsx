import { search } from "lumiose/router";

const q = () => search().get("q") ?? "";

export default function SearchPage() {
  return (
    <section>
      <p id="q">q={q()}</p>
      <button id="more" onClick={() => search.set({ q: `${q()}b` })}>
        more
      </button>
    </section>
  );
}
