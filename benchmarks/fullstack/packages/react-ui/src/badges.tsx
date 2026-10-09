import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  type Label,
  type Priority,
  type Status,
} from "@bench/data/format";

export function StatusBadge({ status, testId }: { status: Status; testId?: string }) {
  return (
    <span className={`badge status-${status}`} data-testid={testId} data-status={status}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function PriorityBadge({ priority, testId }: { priority: Priority; testId?: string }) {
  return (
    <span className={`badge priority-${priority}`} data-testid={testId} data-priority={priority}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export function LabelList({ labels, testId }: { labels: Label[]; testId?: string }) {
  return (
    <ul className="labels" data-testid={testId}>
      {labels.map((label) => (
        <li key={label.id} className={`label label-${label.name}`} data-testid="label-chip">
          {label.name}
        </li>
      ))}
    </ul>
  );
}
