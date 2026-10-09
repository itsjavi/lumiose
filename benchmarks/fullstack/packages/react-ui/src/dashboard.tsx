import {
  PRIORITIES,
  PRIORITY_LABELS,
  STATUSES,
  STATUS_LABELS,
  formatDate,
  type Dashboard,
  type IssueSummary,
  type ProjectStats,
  type SearchHit,
} from "@bench/data/format";
import { PriorityBadge, StatusBadge } from "./badges.tsx";
import type { LinkComponent } from "./link.tsx";

export function DashboardStats({
  byStatus,
  byPriority,
}: Pick<Dashboard, "byStatus" | "byPriority">) {
  return (
    <>
      <section className="stats" data-testid="status-stats" aria-label="Issues by status">
        {STATUSES.map((status) => (
          <div key={status} className={`stat-card status-${status}`} data-testid={`stat-${status}`}>
            <span className="stat-label">{STATUS_LABELS[status]}</span>
            <span className="stat-value">{byStatus[status]}</span>
          </div>
        ))}
      </section>
      <section
        className="stats"
        data-testid="priority-stats"
        aria-label="Unresolved issues by priority"
      >
        {PRIORITIES.map((priority) => (
          <div
            key={priority}
            className={`stat-card priority-${priority}`}
            data-testid={`stat-${priority}`}
          >
            <span className="stat-label">{PRIORITY_LABELS[priority]}</span>
            <span className="stat-value">{byPriority[priority]}</span>
          </div>
        ))}
      </section>
    </>
  );
}

export function ProjectTable({
  Link,
  projects,
}: {
  Link: LinkComponent;
  projects: ProjectStats[];
}) {
  return (
    <table className="table" data-testid="project-table">
      <thead>
        <tr>
          <th>Project</th>
          <th className="num">Open</th>
          <th className="num">In progress</th>
          <th className="num">Closed</th>
          <th className="num">Total</th>
        </tr>
      </thead>
      <tbody>
        {projects.map((project) => (
          <tr key={project.slug} data-testid="project-row">
            <td>
              <Link href={`/projects/${project.slug}`}>{project.name}</Link>
            </td>
            <td className="num">{project.open}</td>
            <td className="num">{project.inProgress}</td>
            <td className="num">{project.closed}</td>
            <td className="num">{project.total}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A compact list of issues (the dashboard's "recently updated", testId `recent-issues`). */
export function IssueList({
  Link,
  issues,
  testId,
}: {
  Link: LinkComponent;
  issues: IssueSummary[];
  testId: string;
}) {
  return (
    <ul className="issue-list" data-testid={testId}>
      {issues.map((issue) => (
        <li key={issue.id} className="issue-item">
          <Link href={`/issues/${issue.id}`} className="issue-link">
            <span className="issue-number">#{issue.id}</span> {issue.title}
          </Link>
          <span className="issue-item-meta">
            <StatusBadge status={issue.status} />
            <PriorityBadge priority={issue.priority} />
            <span className="muted">{issue.project.name}</span>
            <time dateTime={issue.updatedAt}>{formatDate(issue.updatedAt)}</time>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function SearchResults({ Link, hits }: { Link: LinkComponent; hits: SearchHit[] }) {
  return (
    <ul className="issue-list" data-testid="search-results">
      {hits.map((hit) => (
        <li key={hit.id} className="issue-item" data-testid="search-result">
          <Link href={`/issues/${hit.id}`} className="issue-link">
            <span className="issue-number">#{hit.id}</span> {hit.title}
          </Link>
          <span className="issue-item-meta">
            <StatusBadge status={hit.status} />
            <span className="muted">{hit.project.name}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
