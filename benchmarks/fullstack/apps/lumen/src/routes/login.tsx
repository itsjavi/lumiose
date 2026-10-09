// Login by username (doc-4 §2): the action sets the `uid` cookie and redirects to the dashboard.
import { Title, actionData, fail, redirect, type Action } from "lumen";
import { LoginFields } from "../components/forms.tsx";
import { ReadyScript } from "../components/layout.tsx";
import { validateLogin } from "../server/data.ts";
import { login } from "../server/session.ts";

interface Failure {
  username: string;
  error: string;
}

export const action: Action = async (ctx) => {
  const username = (await ctx.formData()).get("username");
  const parsed = validateLogin(username);
  if (!parsed.ok) {
    return fail(400, {
      username: typeof username === "string" ? username : "",
      error: parsed.errors.username ?? "",
    } satisfies Failure);
  }
  login(ctx, parsed.value);
  redirect("/");
};

export default function LoginPage() {
  const failure = actionData<Failure>();
  return (
    <>
      <Title>Log in · Tracker</Title>
      <h1 class="page-title">Log in</h1>
      <form method="post" class="form login-form">
        <LoginFields username={failure?.username ?? ""} error={failure?.error} />
      </form>
      <ReadyScript />
    </>
  );
}
