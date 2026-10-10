// Dashboard and list components: the markup of @bench/react-ui's dashboard.tsx.
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

export function DashboardStats(props: Pick<Dashboard, "byStatus" | "byPriority">) {
  return (
    <>
      <section class="stats" data-testid="status-stats" aria-label="Issues by status">
        {STATUSES.map((status) => (
          <div class={`stat-card status-${status}`} data-testid={`stat-${status}`}>
            <span class="stat-label">{STATUS_LABELS[status]}</span>
            <span class="stat-value">{props.byStatus[status]}</span>
          </div>
        ))}
      </section>
      <section
        class="stats"
        data-testid="priority-stats"
        aria-label="Unresolved issues by priority"
      >
        {PRIORITIES.map((priority) => (
          <div class={`stat-card priority-${priority}`} data-testid={`stat-${priority}`}>
            <span class="stat-label">{PRIORITY_LABELS[priority]}</span>
            <span class="stat-value">{props.byPriority[priority]}</span>
          </div>
        ))}
      </section>
    </>
  );
}

export function ProjectTable(props: { projects: ProjectStats[] }) {
  return (
    <table class="table" data-testid="project-table">
      <thead>
        <tr>
          <th>Project</th>
          <th class="num">Open</th>
          <th class="num">In progress</th>
          <th class="num">Closed</th>
          <th class="num">Total</th>
        </tr>
      </thead>
      <tbody>
        {props.projects.map((project) => (
          <tr data-testid="project-row">
            <td>
              <a href={`/projects/${project.slug}`}>{project.name}</a>
            </td>
            <td class="num">{project.open}</td>
            <td class="num">{project.inProgress}</td>
            <td class="num">{project.closed}</td>
            <td class="num">{project.total}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A compact list of issues (dashboard "recently updated"). */
export function IssueList(props: { issues: IssueSummary[]; testId: string }) {
  return (
    <ul class="issue-list" data-testid={props.testId}>
      {props.issues.map((issue) => (
        <li class="issue-item">
          <a href={`/issues/${issue.id}`} class="issue-link">
            <span class="issue-number">#{issue.id}</span> {issue.title}
          </a>
          <span class="issue-item-meta">
            <StatusBadge status={issue.status} />
            <PriorityBadge priority={issue.priority} />
            <span class="muted">{issue.project.name}</span>
            <time datetime={issue.updatedAt}>{formatDate(issue.updatedAt)}</time>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function SearchResults(props: { hits: SearchHit[] }) {
  return (
    <ul class="issue-list" data-testid="search-results">
      {props.hits.map((hit) => (
        <li class="issue-item" data-testid="search-result">
          <a href={`/issues/${hit.id}`} class="issue-link">
            <span class="issue-number">#{hit.id}</span> {hit.title}
          </a>
          <span class="issue-item-meta">
            <StatusBadge status={hit.status} />
            <span class="muted">{hit.project.name}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
