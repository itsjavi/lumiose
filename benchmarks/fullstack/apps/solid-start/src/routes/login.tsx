import { Title } from "@solidjs/meta";
import { useSubmission } from "@solidjs/router";
import { LoginFields } from "../components/forms.tsx";
import { PageTitle } from "../components/layout.tsx";
import { login } from "../lib/api.ts";

export default function Login() {
  const submission = useSubmission(login);
  return (
    <>
      <Title>Log in · Tracker</Title>
      <PageTitle>Log in</PageTitle>
      <form action={login} method="post" class="form login-form">
        <LoginFields
          username={submission.result?.username ?? ""}
          error={submission.result?.error}
        />
      </form>
    </>
  );
}
