import type { Handle } from "remix/component";

import { routes } from "../../routes.ts";
import { Field } from "../../ui/fields.tsx";

export function LoginPage(handle: Handle<{ username?: string; error?: string }>) {
  return () => (
    <>
      <h1 class="page-title">Log in</h1>
      <form method="post" action={routes.login.action.href()} class="form login-form">
        <Field name="username" label="Username" error={handle.props.error}>
          <input
            id="username"
            name="username"
            defaultValue={handle.props.username ?? ""}
            autoComplete="username"
          />
        </Field>
        <button type="submit" class="btn btn-primary" data-testid="login-submit">
          Log in
        </button>
        <p class="muted">
          Try <code>alice</code> or <code>bob</code>.
        </p>
      </form>
    </>
  );
}
