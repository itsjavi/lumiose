import { validateLogin } from "@bench/data";
import { redirect } from "remix/response/redirect";
import { createController } from "remix/router";

import { sessionCookie } from "../../middleware/session.ts";
import { routes } from "../../routes.ts";
import { renderPage } from "../page.tsx";
import { LoginPage } from "./page.tsx";

export default createController(routes.login, {
  actions: {
    index(context) {
      return renderPage(context, "Log in", <LoginPage />);
    },

    async action(context) {
      const username = context.formData.get("username");
      const result = validateLogin(username);
      if (!result.ok) {
        const value = typeof username === "string" ? username : "";
        return renderPage(
          context,
          "Log in",
          <LoginPage username={value} error={result.errors.username} />,
          { status: 400 },
        );
      }
      return redirect(routes.home.href(), {
        status: 303,
        headers: { "Set-Cookie": await sessionCookie.serialize(String(result.value.id)) },
      });
    },
  },
});
