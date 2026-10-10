This is a Lumiose app rendered on the server. Add a todo list page at `/todos` backed by `src/server/todos.server.ts`. Everything must work without client-side JavaScript, using Lumiose named form actions (`add`, `toggle` and `remove`) on that page.

- `<h1>Todos</h1>`, then a form with a text input `title` and a button "Add" that runs the `add` action.
- A `<ul class="todos">` with one `<li data-id="<id>">` per todo, showing its title; the `<li>` also has the class `done` when the todo is done. Each item has a "Toggle" button (runs `toggle`) and a "Remove" button (runs `remove`), each in its own form that sends the todo's `id`.
- After a successful action, redirect back to `/todos`.
- Adding an empty title (after trimming) re-renders the page with status 400, the message "Title is required." and the current list.

When you are done, `lumiose check` must pass.
