// The layout shared by every page (header, project sidebar, main, footer): the markup of
// @bench/react-ui's AppShell, so every app renders the same HTML.
import type { Project, User } from "@bench/data/format";

export function AppShell(props: {
  projects: Project[];
  user: User | undefined;
  children?: JSX.Element;
}) {
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
          {props.user ? (
            <>
              <span class="user-name">{props.user.displayName}</span>
              <form method="post" action="/logout" class="logout-form">
                <button type="submit" class="btn btn-link" data-testid="logout-button">
                  Log out
                </button>
              </form>
            </>
          ) : (
            <a href="/login" data-testid="login-link">
              Log in
            </a>
          )}
        </div>
      </header>
      <div class="app-body">
        <Sidebar projects={props.projects} />
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

function Sidebar(props: { projects: Project[] }) {
  return (
    <aside class="sidebar" data-testid="sidebar">
      <h2 class="sidebar-title">Projects</h2>
      <ul class="project-list">
        {props.projects.map((project) => (
          <li>
            <a href={`/projects/${project.slug}`} data-testid="sidebar-project">
              <span class="project-name">{project.name}</span>
              <span class="count">{project.openCount}</span>
            </a>
          </li>
        ))}
      </ul>
    </aside>
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

/**
 * The readiness mark of doc-4 §4 for pages without islands: they are interactive once parsed.
 * Pages with an island mark it from the island instead (see lib/ready.ts).
 */
export function ReadyScript() {
  return <script innerHTML="window.__benchReady??=performance.now()" />;
}
