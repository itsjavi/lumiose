import { createAsync } from "@solidjs/router";
import { For, Show, type JSX, type ParentProps } from "solid-js";
import { getShell, logout } from "../lib/api.ts";

/** The layout shared by every page: header, project sidebar, main content and footer. */
export function AppShell(props: ParentProps) {
  const shell = createAsync(() => getShell(), { deferStream: true });
  return (
    <div class="app">
      <header class="app-header" data-testid="app-header">
        <a href="/" class="brand">
          Tracker
        </a>
        <nav class="nav" data-testid="nav">
          <a href="/">Dashboard</a>
          <a href="/issues/new">New issue</a>
          <a href="/search">Search</a>
        </nav>
        <div class="user" data-testid="current-user">
          <Show
            when={shell()?.user}
            fallback={
              <a href="/login" data-testid="login-link">
                Log in
              </a>
            }
          >
            {(user) => (
              <>
                <span class="user-name">{user().displayName}</span>
                <form action={logout} method="post" class="logout-form">
                  <button type="submit" class="btn btn-link" data-testid="logout-button">
                    Log out
                  </button>
                </form>
              </>
            )}
          </Show>
        </div>
      </header>
      <div class="app-body">
        <aside class="sidebar" data-testid="sidebar">
          <h2 class="sidebar-title">Projects</h2>
          <ul class="project-list">
            <For each={shell()?.projects}>
              {(project) => (
                <li>
                  <a href={`/projects/${project.slug}`} data-testid="sidebar-project">
                    <span class="project-name">{project.name}</span>
                    <span class="count">{project.openCount}</span>
                  </a>
                </li>
              )}
            </For>
          </ul>
        </aside>
        <main class="main" data-testid="main">
          {props.children}
        </main>
      </div>
      <footer class="app-footer" data-testid="app-footer">
        Tracker · fullstack comparison benchmark
      </footer>
    </div>
  );
}

export function NotFound() {
  return (
    <section class="not-found" data-testid="not-found">
      <h1 class="page-title">Page not found</h1>
      <p class="muted">The page you are looking for does not exist.</p>
      <a href="/" class="btn">
        Back to the dashboard
      </a>
    </section>
  );
}

/** A page's `<h1>`. */
export function PageTitle(props: { children: JSX.Element }) {
  return <h1 class="page-title">{props.children}</h1>;
}
