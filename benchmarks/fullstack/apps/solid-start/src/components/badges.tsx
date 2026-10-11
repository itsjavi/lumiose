import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  type Label,
  type Priority,
  type Status,
} from "@bench/data/format";
import { For, Show } from "solid-js";

export function StatusBadge(props: { status: Status }) {
  return <span class={`badge status-${props.status}`}>{STATUS_LABELS[props.status]}</span>;
}

export function PriorityBadge(props: { priority: Priority }) {
  return <span class={`badge priority-${props.priority}`}>{PRIORITY_LABELS[props.priority]}</span>;
}

export function LabelList(props: { labels: Label[]; testId?: string }) {
  return (
    <Show when={props.labels.length > 0}>
      <ul class="labels" data-testid={props.testId}>
        <For each={props.labels}>
          {(label) => <li class={`label label-${label.name}`}>{label.name}</li>}
        </For>
      </ul>
    </Show>
  );
}
