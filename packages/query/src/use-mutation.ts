import {
  MutationObserver,
  noop,
  notifyManager,
  type DefaultError,
  type QueryClient,
} from "@tanstack/query-core";
import { effect, store, untrack } from "lumiose";
import { useQueryClient } from "./client.ts";
import { initialResult, writeResult } from "./result.ts";
import type { UseMutateFunction, UseMutationOptions, UseMutationResult } from "./types.ts";

/**
 * A mutation: call `mutate(variables)` (or `await mutateAsync(variables)`) to run `mutationFn`.
 * `options` is an accessor, tracked like `useQuery`'s. Returns the state as a store
 * (`isPending`, `data`, `error`, …). It unsubscribes when its owner is disposed.
 */
export function useMutation<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TOnMutateResult = unknown,
>(
  options: UseMutationOptions<TData, TError, TVariables, TOnMutateResult>,
  queryClient?: () => QueryClient,
): UseMutationResult<TData, TError, TVariables, TOnMutateResult> {
  type Result = UseMutationResult<TData, TError, TVariables, TOnMutateResult>;
  const client = useQueryClient(queryClient?.());
  const observer = new MutationObserver<TData, TError, TVariables, TOnMutateResult>(
    client,
    untrack(options),
  );
  const mutate: UseMutateFunction<TData, TError, TVariables, TOnMutateResult> = (...args) => {
    observer.mutate(args[0] as TVariables, args[1]).catch(noop);
  };
  const resultOf = (result: ReturnType<typeof observer.getCurrentResult>): Result =>
    ({ ...result, mutate, mutateAsync: result.mutate }) as Result;
  const state = store(initialResult(resultOf(observer.getCurrentResult())));

  effect(() => {
    const opts = options();
    untrack(() => observer.setOptions(opts));
  });
  effect(() =>
    untrack(() => {
      const unsubscribe = observer.subscribe(
        notifyManager.batchCalls((result) => writeResult(state, resultOf(result))),
      );
      writeResult(state, resultOf(observer.getCurrentResult()));
      return unsubscribe;
    }),
  );
  return state;
}
