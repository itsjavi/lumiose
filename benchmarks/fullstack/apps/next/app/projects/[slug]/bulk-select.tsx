"use client";

import type { IssueSummary } from "@bench/data/format";
import { BulkBar, IssueTable } from "@bench/react-ui";
import { useActionState, useState } from "react";
import { closeSelected } from "../../actions";
import { AppLink } from "../../lib/link";

/** Row checkboxes and "Close selected"; the server action refreshes the list. */
export function BulkSelect({ issues }: { issues: IssueSummary[] }) {
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [, formAction, pending] = useActionState(
    (_state: null, form: FormData) => closeSelected(form).then(() => null),
    null,
  );
  const toggleAll = () =>
    setSelected((current) =>
      issues.every((issue) => current.has(issue.id))
        ? new Set()
        : new Set(issues.map((issue) => issue.id)),
    );
  const toggle = (id: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  return (
    // The form data is read when the form submits, before the selection is cleared.
    <form action={formAction} className="bulk-form" onSubmit={() => setSelected(new Set())}>
      <IssueTable
        Link={AppLink}
        issues={issues}
        selected={selected}
        onToggle={toggle}
        onToggleAll={toggleAll}
      />
      <BulkBar count={selected.size} pending={pending} />
    </form>
  );
}
