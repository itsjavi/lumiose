import { navigate } from "lumiose/router";

export default function Home() {
  return (
    <section>
      <h1 id="home">Home</h1>
      <button id="go" onClick={() => navigate("/users/2")}>
        open user 2
      </button>
    </section>
  );
}
