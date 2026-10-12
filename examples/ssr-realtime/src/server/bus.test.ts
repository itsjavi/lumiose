import { expect, it } from "vitest";
import { publish, subscribe, subscriberCount } from "./bus.server.ts";

it("delivers messages to subscribers until they unsubscribe", () => {
  const received: string[] = [];
  const unsubscribe = subscribe((message) => received.push(message.text));
  expect(subscriberCount()).toBe(1);
  publish("one");
  unsubscribe();
  publish("two");
  expect(received).toEqual(["one"]);
  expect(subscriberCount()).toBe(0);
});
