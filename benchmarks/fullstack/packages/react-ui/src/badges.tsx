import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  type Label,
  type Priority,
  type Status,
} from "@bench/data/format";

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge status-${status}`}>{STATUS_LABELS[status]}</span>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`badge priority-${priority}`}>{PRIORITY_LABELS[priority]}</span>;
}

export function LabelList({ labels, testId }: { labels: Label[]; testId?: string }) {
  if (labels.length === 0) return null;
  return (
    <ul className="labels" data-testid={testId}>
      {labels.map((label) => (
        <li key={label.id} className={`label label-${label.name}`}>
          {label.name}
        </li>
      ))}
    </ul>
  );
}
