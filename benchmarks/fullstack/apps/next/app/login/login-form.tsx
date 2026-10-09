"use client";

import { LoginFields } from "@bench/react-ui";
import { useActionState } from "react";
import { login } from "../actions";

export function LoginForm() {
  const [state, formAction] = useActionState(login, { username: "" });
  return (
    <form action={formAction} className="form login-form">
      <LoginFields username={state.username} error={state.error} />
    </form>
  );
}
