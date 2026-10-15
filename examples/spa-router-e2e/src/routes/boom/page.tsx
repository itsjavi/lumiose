// TASK-299: a page that throws while it renders; the router shows its error page and the client
// instrumentation's onError receives the error.
export default function BoomPage(): never {
  throw new Error("boom page");
}
