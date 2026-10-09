import { validateLogin } from "@bench/data";
import { LoginFields, PageTitle } from "@bench/react-ui";
import { Form, data, redirect } from "react-router";
import { sessionCookie } from "../lib/session.server";
import type { Route } from "./+types/login";

export const meta: Route.MetaFunction = () => [{ title: "Log in · Tracker" }];

export async function action({ request }: Route.ActionArgs) {
  const username = (await request.formData()).get("username");
  const result = validateLogin(username);
  if (!result.ok) {
    return data(
      { username: String(username ?? ""), error: result.errors.username },
      { status: 400 },
    );
  }
  return redirect("/", { headers: { "Set-Cookie": sessionCookie(result.value) } });
}

export default function Login({ actionData }: Route.ComponentProps) {
  return (
    <>
      <PageTitle>Log in</PageTitle>
      <Form method="post" className="form login-form">
        <LoginFields username={actionData?.username ?? ""} error={actionData?.error} />
      </Form>
    </>
  );
}
