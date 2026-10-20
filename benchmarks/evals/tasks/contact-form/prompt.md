This is a Lumiose app rendered on the server. Add a contact page at `/contact`.

- It has a form with an `email` input and a `message` textarea. The form must work without any client-side JavaScript: handle the submission with a Lumiose form action on that page.
- Validation: if the email does not contain `@`, show "Enter a valid email."; if the message is empty (after trimming), show "Write a message.". Invalid submissions re-render the page with HTTP status 400, show each error next to its field, and keep what the user typed in both fields.
- A valid submission stores the message with `saveMessage(email, message)` from `src/server/messages.server.ts` and redirects to `/contact/thanks`, a page whose `<h1>` is "Thanks for your message".

When you are done, `lumiose check` must pass.
