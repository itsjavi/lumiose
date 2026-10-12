// What the feed and the chat carry. No server imports: islands share it.

export interface Message {
  id: number;
  text: string;
  /** ISO time it was published. */
  at: string;
}

/** Longest message accepted, in characters. */
export const MAX_TEXT = 500;
