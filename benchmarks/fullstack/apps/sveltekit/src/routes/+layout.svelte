<script lang="ts">
  import "@bench/ui-css/tracker.css";
  import { enhance } from "$app/forms";
  import { afterNavigate } from "$app/navigation";
  import type { LayoutProps } from "./$types";

  let { data, children }: LayoutProps = $props();

  // The readiness mark of doc-4 §4. SvelteKit calls afterNavigate once the app (the page included)
  // has hydrated, and again after every client-side navigation.
  afterNavigate(() => {
    // oxlint-disable-next-line no-underscore-dangle -- the name is fixed by doc-4 §4
    window.__benchReady ??= performance.now();
  });
</script>

<div class="app">
  <header class="app-header" data-testid="app-header">
    <a href="/" class="brand">Tracker</a>
    <nav class="nav" data-testid="nav">
      <a href="/">Dashboard</a>
      <a href="/issues/new">New issue</a>
      <a href="/search">Search</a>
    </nav>
    <div class="user" data-testid="current-user">
      {#if data.user}
        <span class="user-name">{data.user.displayName}</span>
        <form method="POST" action="/logout" class="logout-form" use:enhance>
          <button type="submit" class="btn btn-link" data-testid="logout-button">Log out</button>
        </form>
      {:else}
        <a href="/login" data-testid="login-link">Log in</a>
      {/if}
    </div>
  </header>
  <div class="app-body">
    <aside class="sidebar" data-testid="sidebar">
      <h2 class="sidebar-title">Projects</h2>
      <ul class="project-list">
        {#each data.projects as project (project.slug)}
          <li>
            <a href="/projects/{project.slug}" data-testid="sidebar-project">
              <span class="project-name">{project.name}</span>
              <span class="count">{project.openCount}</span>
            </a>
          </li>
        {/each}
      </ul>
    </aside>
    <main class="main" data-testid="main">
      {@render children()}
    </main>
  </div>
  <footer class="app-footer" data-testid="app-footer">Tracker · fullstack comparison benchmark</footer>
</div>
