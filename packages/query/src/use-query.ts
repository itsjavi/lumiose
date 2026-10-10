import {
  notifyManager,
  QueryObserver,
  type DefaultError,
  type QueryClient,
  type QueryKey,
} from "@tanstack/query-core";
import { effect, store, untrack } from "lumiose";
import { useQueryClient } from "./client.ts";
import { initialResult, writeResult } from "./result.ts";
import type {
  DefinedInitialDataOptions,
  DefinedUseQueryResult,
  QueryOptions,
  UndefinedInitialDataOptions,
  UseQueryOptions,
  UseQueryResult,
} from "./types.ts";

/**
 * Subscribes to a query. `options` is an accessor: when a signal it reads changes (a key part,
 * `enabled`), the observer gets the new options. Returns the result as a store: read
 * `query.data`, `query.isPending` and the other fields where they are used.
 *
 * The observer subscribes in an effect, so it fetches once mounted in the browser and never on
 * the server, where the result stays pending. It unsubscribes when its owner is disposed.
 */
export function useQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: UndefinedInitialDataOptions<TQueryFnData, TError, TData, TQueryKey>,
  queryClient?: () => QueryClient,
): UseQueryResult<TData, TError>;
export function useQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: DefinedInitialDataOptions<TQueryFnData, TError, TData, TQueryKey>,
  queryClient?: () => QueryClient,
): DefinedUseQueryResult<TData, TError>;
export function useQuery<
  TQueryFnData,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
  queryClient?: () => QueryClient,
): UseQueryResult<TData, TError> {
  const client = useQueryClient(queryClient?.());
  const defaulted = () => {
    const opts = client.defaultQueryOptions(
      options() as QueryOptions<TQueryFnData, TError, TData, TQueryKey>,
    );
    // oxlint-disable-next-line no-underscore-dangle -- query-core option: report the fetch a mount starts
    opts._optimisticResults = "optimistic";
    // `reconcile` keeps unchanged data's identity; query-core's own pass would repeat the work.
    opts.structuralSharing = false;
    return opts;
  };
  const reconcileOption = () => (observer.options as QueryOptions).reconcile;
  const initial = untrack(defaulted);
  const observer = new QueryObserver<TQueryFnData, TError, TData, TQueryFnData, TQueryKey>(
    client,
    initial,
  );
  const state = store(
    initialResult(observer.getOptimisticResult(initial), (initial as QueryOptions).reconcile),
  );
  const write = (result: object) => writeResult(state, result, reconcileOption());

  // Tracks the accessor; the rest is untracked, since a fetch can start (and call `queryFn`) here.
  effect(() => {
    const opts = defaulted();
    untrack(() => {
      observer.setOptions(opts);
      write(observer.getOptimisticResult(opts));
    });
  });
  // Effects never run on the server: no subscription, so no fetch there.
  effect(() =>
    untrack(() => {
      const unsubscribe = observer.subscribe(notifyManager.batchCalls(write));
      observer.updateResult();
      write(observer.getCurrentResult());
      return unsubscribe;
    }),
  );
  return state;
}
