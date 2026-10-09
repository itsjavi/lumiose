// How `submit()` redirects and `invalidate()` refreshes (spec §8 Actions): a full page load, unless
// the SPA router (TASK-25) installs its hooks. Apart from ./client.ts so that the router installs
// them without bundling the form helpers (TASK-91).

/** How `submit()` redirects and `invalidate()` refresh. The SPA router replaces the MPA default. */
export interface ClientNavigation {
  /**
   * Whether pages are client-routed, so that `invalidate()` re-runs async components without a
   * reload. Only then does a successful `submit()` invalidate on its own (decision-20 amendment).
   */
  clientRouted: boolean;
  navigate(href: string): void | Promise<void>;
  invalidate(): void | Promise<void>;
}

export let navigation: ClientNavigation = {
  clientRouted: false,
  navigate: (href) => location.assign(href),
  invalidate: () => location.reload(),
};

/** Installs navigation hooks (the SPA router does, TASK-25). Returns a function that undoes it. */
export function setClientNavigation(hooks: ClientNavigation): () => void {
  const previous = navigation;
  navigation = hooks;
  return () => {
    navigation = previous;
  };
}
