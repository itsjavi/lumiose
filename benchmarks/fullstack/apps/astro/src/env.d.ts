declare namespace App {
  interface Locals {
    /** The signed-in user (doc-4 §2 session cookie), set by the middleware. */
    user: import("@bench/data").User | undefined;
  }
}
