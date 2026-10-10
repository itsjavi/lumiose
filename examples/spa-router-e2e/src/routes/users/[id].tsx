import { fetchJSON, invalidate, Title, type PageProps } from "lumiose";

interface User {
  id: string;
  name: string;
  hits: number;
}

// An async page: a navigation to it keeps the previous page on screen until the user has loaded.
// `invalidate()` loads it again.
export default async function UserPage(props: PageProps<"/users/[id]">) {
  const user = await fetchJSON<User>(`/api/users/${props.params.id}`);
  return (
    <article>
      <Title>{user.name}</Title>
      <h1 id="user">{user.name}</h1>
      <p id="hits">load {user.hits}</p>
      <button id="refresh" onClick={() => invalidate()}>
        refresh
      </button>
    </article>
  );
}
