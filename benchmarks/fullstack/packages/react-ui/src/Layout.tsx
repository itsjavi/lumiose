import type { Project, User } from "@bench/data/format";
import type { ReactNode } from "react";
import type { LinkComponent } from "./link.tsx";

export interface AppShellProps {
  Link: LinkComponent;
  projects: Project[];
  user: User | undefined;
  /** The app's logout form (`data-testid="logout-form"`, wrapping `<LogoutButton>`), shown with a user. */
  logout: ReactNode;
  children: ReactNode;
}

/** The layout shared by every page: header, project sidebar, main content and footer. */
export function AppShell({ Link, projects, user, logout, children }: AppShellProps) {
  return (
    <div className="app">
      <header className="app-header" data-testid="site-header">
        <Link href="/" className="brand">
          Tracker
        </Link>
        <nav className="nav">
          <Link href="/" data-testid="nav-home">
            Dashboard
          </Link>
          <Link href="/issues/new" data-testid="nav-new-issue">
            New issue
          </Link>
          <Link href="/search" data-testid="nav-search">
            Search
          </Link>
        </nav>
        <div className="user">
          {user ? (
            <>
              <span className="user-name" data-testid="current-user">
                {user.name}
              </span>
              {logout}
            </>
          ) : (
            <Link href="/login" data-testid="login-link">
              Log in
            </Link>
          )}
        </div>
      </header>
      <div className="app-body">
        <Sidebar Link={Link} projects={projects} />
        <main className="main">{children}</main>
      </div>
      <footer className="app-footer" data-testid="site-footer">
        Tracker benchmark · the same app in Lumen, React Router and Next.js
      </footer>
    </div>
  );
}

export function Sidebar({ Link, projects }: { Link: LinkComponent; projects: Project[] }) {
  return (
    <aside className="sidebar" data-testid="sidebar">
      <h2 className="sidebar-title">Projects</h2>
      <ul className="project-list">
        {projects.map((project) => (
          <li key={project.slug}>
            <Link href={`/projects/${project.slug}`} data-testid="sidebar-project">
              <span className="project-name">{project.name}</span>
              <span className="count" data-testid="sidebar-project-count">
                {project.openCount}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function LogoutButton() {
  return (
    <button type="submit" className="btn btn-link">
      Log out
    </button>
  );
}

export function NotFound({ Link }: { Link: LinkComponent }) {
  return (
    <section className="not-found" data-testid="not-found">
      <h1 className="page-title" data-testid="page-title">
        Page not found
      </h1>
      <p className="muted">The page you are looking for does not exist.</p>
      <Link href="/" className="btn">
        Back to the dashboard
      </Link>
    </section>
  );
}

/** A page's `<h1>`. */
export function PageTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="page-title" data-testid="page-title">
      {children}
    </h1>
  );
}
