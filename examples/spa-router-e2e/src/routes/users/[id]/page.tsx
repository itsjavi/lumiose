import { fetchJSON, invalidate, Title, type PageProps } from "lumiose";

interface User {
  id: string;
  name: string;
  hits: number;
}

// An async page: a navigation to it keeps the previous page on screen until the user has loaded.
// `invalidate()` loads the whole page again; `invalidate(url)` refetches only that URL's entry
// and re-runs the components that awaited it. Going back to a user already seen shows the cached
// data at once and revalidates it.
export default async function UserPage(props: PageProps<"/users/[id]">) {
  const api = `/api/users/${props.params.id}`;
  const user = await fetchJSON<User>(api);
  return (
    <article>
      <Title>{user.name}</Title>
      <h1 id="user">{user.name}</h1>
      <p id="hits">load {user.hits}</p>
      <button id="refresh" onClick={() => invalidate()}>
        refresh
      </button>
      <button id="refetch" onClick={() => invalidate(api)}>
        refetch user
      </button>
    </article>
  );
}
