import {
  PRIORITIES,
  PRIORITY_LABELS,
  STATUSES,
  STATUS_LABELS,
  formatDate,
  type Dashboard,
  type IssueSummary,
  type ProjectStats,
} from "@bench/data/format";
import type { Handle } from "remix/component";

import { routes } from "../routes.ts";
import { PriorityBadge, StatusBadge } from "./badges.tsx";

export function DashboardStats(handle: Handle<Pick<Dashboard, "byStatus" | "byPriority">>) {
  return () => {
    const { byStatus, byPriority } = handle.props;
    return (
      <>
        <section class="stats" data-testid="status-stats" aria-label="Issues by status">
          {STATUSES.map((status) => (
            <div key={status} class={`stat-card status-${status}`} data-testid={`stat-${status}`}>
              <span class="stat-label">{STATUS_LABELS[status]}</span>
              <span class="stat-value">{byStatus[status]}</span>
            </div>
          ))}
        </section>
        <section
          class="stats"
          data-testid="priority-stats"
          aria-label="Unresolved issues by priority"
        >
          {PRIORITIES.map((priority) => (
            <div
              key={priority}
              class={`stat-card priority-${priority}`}
              data-testid={`stat-${priority}`}
            >
              <span class="stat-label">{PRIORITY_LABELS[priority]}</span>
              <span class="stat-value">{byPriority[priority]}</span>
            </div>
          ))}
        </section>
      </>
    );
  };
}

export function ProjectTable(handle: Handle<{ projects: ProjectStats[] }>) {
  return () => (
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
        {handle.props.projects.map((project) => (
          <tr key={project.slug} data-testid="project-row">
            <td>
              <a href={routes.projects.show.href({ slug: project.slug })}>{project.name}</a>
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

/** A compact list of issues (the dashboard's "recently updated", testId `recent-issues`). */
export function IssueList(handle: Handle<{ issues: IssueSummary[]; testId: string }>) {
  return () => (
    <ul class="issue-list" data-testid={handle.props.testId}>
      {handle.props.issues.map((issue) => (
        <li key={issue.id} class="issue-item">
          <a href={routes.issues.show.href({ id: String(issue.id) })} class="issue-link">
            <span class="issue-number">#{issue.id}</span> {issue.title}
          </a>
          <span class="issue-item-meta">
            <StatusBadge status={issue.status} />
            <PriorityBadge priority={issue.priority} />
            <span class="muted">{issue.project.name}</span>
            <time dateTime={issue.updatedAt}>{formatDate(issue.updatedAt)}</time>
          </span>
        </li>
      ))}
    </ul>
  );
}
