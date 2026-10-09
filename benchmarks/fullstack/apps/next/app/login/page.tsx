import { PageTitle } from "@bench/react-ui";
import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in · Tracker" };

export default function LoginPage() {
  return (
    <>
      <PageTitle>Log in</PageTitle>
      <LoginForm />
    </>
  );
}
