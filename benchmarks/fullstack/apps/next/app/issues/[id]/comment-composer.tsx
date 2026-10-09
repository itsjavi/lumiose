"use client";

import { CommentFields } from "@bench/react-ui";
import { useActionState, useState } from "react";
import { postComment, type CommentState } from "../../actions";

/** Textarea with a live character count; posts through a server action and clears itself on success. */
export function CommentComposer({ issueId }: { issueId: number }) {
  const [body, setBody] = useState("");
  const [state, formAction, pending] = useActionState(
    async (_state: CommentState, form: FormData) => {
      const result = await postComment(issueId, form);
      if (result.ok) setBody("");
      return result;
    },
    { ok: true },
  );
  return (
    <form action={formAction} className="comment-form">
      <CommentFields value={body} onChange={setBody} pending={pending} error={state.error} />
    </form>
  );
}
