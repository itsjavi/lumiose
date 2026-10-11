import type { Project, User } from "@bench/data/format";
import type { Handle, RemixNode } from "remix/component";
import { ImportMap } from "remix/component/server";

import { scriptEntry, stylesHref } from "../assets.ts";
import { routes } from "../routes.ts";

export interface DocumentProps {
  title: string;
  user: User | null;
  projects: Project[];
  children?: RemixNode;
}

/** The document shell and the layout every page shares (doc-4 §2). */
export function Document(handle: Handle<DocumentProps>) {
  return () => {
    const { title, user, projects, children } = handle.props;
    const { href, importMap, preloads } = scriptEntry;

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{`${title} · Tracker`}</title>
          <link rel="stylesheet" href={stylesHref} />
          <ImportMap value={importMap} />
          {preloads.map((preloadHref) => (
            <link key={preloadHref} rel="modulepreload" href={preloadHref} />
          ))}
          <script type="module" src={href}></script>
        </head>
        <body>
          <div class="app">
            <header class="app-header" data-testid="app-header">
              <a href={routes.home.href()} class="brand">
                Tracker
              </a>
              <nav class="nav" data-testid="nav">
                <a href={routes.home.href()}>Dashboard</a>
                <a href={routes.issues.new.index.href()}>New issue</a>
                <a href={routes.search.href()}>Search</a>
              </nav>
              <div class="user" data-testid="current-user">
                {user ? (
                  <>
                    <span class="user-name">{user.displayName}</span>
                    <form method="post" action={routes.logout.href()} class="logout-form">
                      <button type="submit" class="btn btn-link" data-testid="logout-button">
                        Log out
                      </button>
                    </form>
                  </>
                ) : (
                  <a href={routes.login.index.href()} data-testid="login-link">
                    Log in
                  </a>
                )}
              </div>
            </header>
            <div class="app-body">
              <aside class="sidebar" data-testid="sidebar">
                <h2 class="sidebar-title">Projects</h2>
                <ul class="project-list">
                  {projects.map((project) => (
                    <li key={project.slug}>
                      <a
                        href={routes.projects.show.href({ slug: project.slug })}
                        data-testid="sidebar-project"
                      >
                        <span class="project-name">{project.name}</span>
                        <span class="count">{project.openCount}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </aside>
              <main class="main" data-testid="main">
                {children}
              </main>
            </div>
            <footer class="app-footer" data-testid="app-footer">
              Tracker · fullstack comparison benchmark
            </footer>
          </div>
        </body>
      </html>
    );
  };
}
