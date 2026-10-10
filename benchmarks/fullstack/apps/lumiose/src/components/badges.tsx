import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  type Label,
  type Priority,
  type Status,
} from "@bench/data/format";

export function StatusBadge(props: { status: Status }) {
  return <span class={`badge status-${props.status}`}>{STATUS_LABELS[props.status]}</span>;
}

export function PriorityBadge(props: { priority: Priority }) {
  return <span class={`badge priority-${props.priority}`}>{PRIORITY_LABELS[props.priority]}</span>;
}

export function LabelList(props: { labels: Label[]; testId?: string }) {
  return props.labels.length === 0 ? null : (
    <ul class="labels" data-testid={props.testId}>
      {props.labels.map((label) => (
        <li class={`label label-${label.name}`}>{label.name}</li>
      ))}
    </ul>
  );
}
