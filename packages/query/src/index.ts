// @lumiose/query: TanStack Query for Lumiose (doc-6 §E), with the names and call shapes of
// @tanstack/solid-query v5. query-core observers write their results into stores.
export * from "@tanstack/query-core";
export type {
  DefinedInitialDataOptions,
  DefinedUseQueryResult,
  MutationOptions,
  QueryOptions,
  UndefinedInitialDataOptions,
  UseMutateAsyncFunction,
  UseMutateFunction,
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult,
} from "./types.ts";
export { QueryClientProvider, useQueryClient, type QueryClientProviderProps } from "./client.ts";
export { useQuery } from "./use-query.ts";
export { useMutation } from "./use-mutation.ts";
