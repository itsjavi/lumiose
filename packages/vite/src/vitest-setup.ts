// The Vitest setup file @lumiose/vite adds when it runs under Vitest (TASK-193): scoped state
// (`defineState`) starts fresh in every test, in the browser entry and on the server, where code
// outside a request or render then shares one scope per test.
import { resetStates } from "lumiose/internal/core/state.ts";
import { beforeEach } from "vitest";

beforeEach(() => {
  resetStates();
});
