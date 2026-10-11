import type { User } from "@bench/data";

declare global {
  interface Window {
    /** The readiness mark of doc-4 §4. */
    __benchReady?: number;
  }

  namespace App {
    interface Locals {
      /** The signed-in user, from the session cookie (hooks.server.ts). */
      user: User | undefined;
    }
  }
}
