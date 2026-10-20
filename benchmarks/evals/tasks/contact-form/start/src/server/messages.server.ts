// Contact messages, kept in memory for this demo.
export interface Message {
  email: string;
  message: string;
}

const messages: Message[] = [];

export function saveMessage(email: string, message: string): void {
  messages.push({ email, message });
}

export function listMessages(): Message[] {
  return [...messages];
}
