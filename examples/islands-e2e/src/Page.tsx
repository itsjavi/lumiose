import { Counter } from "./Counter.stsx";
import { Greeting } from "./Greeting.stsx";
import { Notes } from "./Notes.stsx";
import { Team } from "./Team.stsx";

/** The server-rendered page: static HTML around five islands. */
export function Page() {
  return (
    <main>
      <h1>Islands</h1>
      <Counter client:load start={3} label="load" />
      <Team client:load ids={["ada", "bob"]} extra={<em>Extra slot</em>}>
        <p class="footer">
          Team footer <b>slot</b>
        </p>
      </Team>
      <Greeting client:load name="world" />
      <Notes client:load items={["a", "b", "c"]} />
      <div style="height: 3000px">Spacer</div>
      <Counter client:visible start={10} label="visible" />
    </main>
  );
}
