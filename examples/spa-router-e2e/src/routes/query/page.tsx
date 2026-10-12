import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@lumiose/query";
import { fetchJSON, signal, type Signal } from "lumiose";

interface User {
  id: string;
  name: string;
  hits: number;
}

// @lumiose/query (TASK-197): two cards share one query (one fetch), the key follows a signal, and
// a mutation invalidates it. The server renders the pending state; the browser fetches once mounted.
const queryClient = new QueryClient();

function UserCard(props: { id: Signal<string>; name: string }) {
  const user = useQuery(() => ({
    queryKey: ["user", props.id()],
    queryFn: () => fetchJSON<User>(`/api/users/${props.id()}`),
  }));
  return (
    <p id={props.name}>
      {user.isPending ? "loading" : `${user.data?.name} · load ${user.data?.hits}`}
    </p>
  );
}

function Controls(props: { id: Signal<string> }) {
  const client = useQueryClient();
  const reload = useMutation(() => ({
    mutationFn: () => new Promise((resolve) => setTimeout(resolve, 20)),
    onSuccess: () => client.invalidateQueries({ queryKey: ["user"] }),
  }));
  return (
    <div>
      <button id="query-user-1" onClick={() => props.id.set("1")}>
        user 1
      </button>
      <button id="query-user-2" onClick={() => props.id.set("2")}>
        user 2
      </button>
      <button id="query-reload" disabled={reload.isPending} onClick={() => reload.mutate()}>
        {reload.isPending ? "reloading" : "reload"}
      </button>
    </div>
  );
}

export default function QueryPage() {
  const id = signal("1");
  return (
    <QueryClientProvider client={queryClient}>
      <h1>@lumiose/query</h1>
      <UserCard id={id} name="query-a" />
      <UserCard id={id} name="query-b" />
      <Controls id={id} />
    </QueryClientProvider>
  );
}
