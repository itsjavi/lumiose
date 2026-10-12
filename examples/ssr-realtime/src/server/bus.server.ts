// An in-process message bus: each event stream subscribes, the form action publishes. It reaches the
// clients of this one process; with several (a cluster, serverless instances), publish through a
// shared channel instead, such as Redis pub/sub or Postgres LISTEN/NOTIFY.
import { MAX_TEXT, type Message } from "../lib/messages.ts";

type Listener = (message: Message) => void;

const listeners = new Set<Listener>();
let nextId = 1;

export function publish(text: string): Message {
  const message = { id: nextId++, text: text.slice(0, MAX_TEXT), at: new Date().toISOString() };
  for (const listener of listeners) listener(message);
  return message;
}

/** Calls `listener` with every message published from now on; returns the unsubscribe. */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function subscriberCount(): number {
  return listeners.size;
}
