// The option and result types of @lumiose/query: the @tanstack/solid-query v5 types, with
// options passed as accessors (`() => ({ queryKey, queryFn })`) and results read from stores.
import type {
  DefaultError,
  DefinedQueryObserverResult,
  MutateFunction,
  MutationObserverOptions,
  MutationObserverResult,
  NonUndefinedGuard,
  OmitKeyof,
  Override,
  QueryKey,
  QueryObserverOptions,
  QueryObserverResult,
} from "@tanstack/query-core";

/**
 * How a new `data` is written into the result store: a key for `reconcile()` (default `"id"`),
 * `false` to replace `data` as it comes from the cache, or a function returning the data to store.
 */
export type ReconcileOption<TData> =
  | string
  | false
  | ((oldData: TData | undefined, newData: TData) => TData);

/** What `useQuery`'s accessor returns. Structural sharing is done by `reconcile` instead. */
export interface QueryOptions<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> extends OmitKeyof<
  QueryObserverOptions<TQueryFnData, TError, TData, TQueryFnData, TQueryKey>,
  "structuralSharing"
> {
  reconcile?: ReconcileOption<TData>;
}

export type UseQueryOptions<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> = () => QueryOptions<TQueryFnData, TError, TData, TQueryKey>;

export type UndefinedInitialDataOptions<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> = () => QueryOptions<TQueryFnData, TError, TData, TQueryKey> & {
  initialData?: undefined;
};

export type DefinedInitialDataOptions<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> = () => QueryOptions<TQueryFnData, TError, TData, TQueryKey> & {
  initialData: NonUndefinedGuard<TQueryFnData> | (() => NonUndefinedGuard<TQueryFnData>);
};

export type UseQueryResult<TData = unknown, TError = DefaultError> = QueryObserverResult<
  TData,
  TError
>;

export type DefinedUseQueryResult<
  TData = unknown,
  TError = DefaultError,
> = DefinedQueryObserverResult<TData, TError>;

/** What `useMutation`'s accessor returns. */
export interface MutationOptions<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TOnMutateResult = unknown,
> extends OmitKeyof<
  MutationObserverOptions<TData, TError, TVariables, TOnMutateResult>,
  "_defaulted"
> {}

export type UseMutationOptions<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TOnMutateResult = unknown,
> = () => MutationOptions<TData, TError, TVariables, TOnMutateResult>;

/** `mutate`: fire and forget; errors go to the result and the callbacks, not to a rejection. */
export type UseMutateFunction<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TOnMutateResult = unknown,
> = (...args: Parameters<MutateFunction<TData, TError, TVariables, TOnMutateResult>>) => void;

export type UseMutateAsyncFunction<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TOnMutateResult = unknown,
> = MutateFunction<TData, TError, TVariables, TOnMutateResult>;

export type UseMutationResult<
  TData = unknown,
  TError = DefaultError,
  TVariables = unknown,
  TOnMutateResult = unknown,
> = Override<
  MutationObserverResult<TData, TError, TVariables, TOnMutateResult>,
  { mutate: UseMutateFunction<TData, TError, TVariables, TOnMutateResult> }
> & {
  mutateAsync: UseMutateAsyncFunction<TData, TError, TVariables, TOnMutateResult>;
};
