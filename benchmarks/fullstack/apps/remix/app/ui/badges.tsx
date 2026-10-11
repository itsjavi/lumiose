import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  type Label,
  type Priority,
  type Status,
} from "@bench/data/format";
import type { Handle } from "remix/component";

export function StatusBadge(handle: Handle<{ status: Status }>) {
  return () => (
    <span class={`badge status-${handle.props.status}`}>{STATUS_LABELS[handle.props.status]}</span>
  );
}

export function PriorityBadge(handle: Handle<{ priority: Priority }>) {
  return () => (
    <span class={`badge priority-${handle.props.priority}`}>
      {PRIORITY_LABELS[handle.props.priority]}
    </span>
  );
}

export function LabelList(handle: Handle<{ labels: Label[]; testId?: string }>) {
  return () => {
    const { labels, testId } = handle.props;
    if (labels.length === 0) return null;
    return (
      <ul class="labels" data-testid={testId}>
        {labels.map((label) => (
          <li key={label.id} class={`label label-${label.name}`}>
            {label.name}
          </li>
        ))}
      </ul>
    );
  };
}
