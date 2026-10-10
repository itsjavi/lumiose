// The QueryClient of a component tree, provided through context (doc-6 §E).
import type { QueryClient } from "@tanstack/query-core";
import { createContext, onMount, useContext } from "lumiose";
import type { JSX } from "lumiose/jsx-runtime";

const QueryClientContext = createContext<QueryClient | undefined>(undefined);

/**
 * The `QueryClient` passed in, or else the one of the nearest `QueryClientProvider`. Throws
 * when there is none.
 */
export function useQueryClient(queryClient?: QueryClient): QueryClient {
  const client = queryClient ?? useContext(QueryClientContext);
  if (client === undefined) {
    throw new Error("No QueryClient set, use QueryClientProvider to set one");
  }
  return client;
}

export interface QueryClientProviderProps {
  /** The `QueryClient` to provide. */
  client: QueryClient;
  /** The components that read it with `useQueryClient`, `useQuery` and `useMutation`. */
  children?: JSX.Element;
}

/**
 * Provides `client` to everything rendered inside it. Once mounted it calls `client.mount()`
 * (refetch on window focus and reconnect, resume paused mutations), and `client.unmount()` when
 * disposed. Islands start a new root: wrap each island that uses queries, with the same client
 * to share its cache.
 */
export function QueryClientProvider(props: QueryClientProviderProps): JSX.Element {
  const client = props.client;
  onMount(() => {
    client.mount();
    return () => client.unmount();
  });
  return QueryClientContext({
    value: client,
    get children() {
      return props.children;
    },
  });
}
