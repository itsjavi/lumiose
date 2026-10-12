import { signal, Title } from "lumiose";

function item(name: string) {
  return <span class="frag-item">{name}</span>;
}

export default function Home() {
  const open = signal(true);
  return (
    <section>
      <Title>Tracks</Title>
      <h1 id="home">Tracks</h1>
      {/* Inserts before a static element in a conditional fragment (TASK-234). */}
      <p id="frag">
        {open() ? (
          <>
            {item("a")}
            {item("b")}
            <label id="frag-static">static</label>
          </>
        ) : null}
      </p>
      <button id="frag-toggle" onClick={() => open.update((v) => !v)}>
        toggle
      </button>
    </section>
  );
}
