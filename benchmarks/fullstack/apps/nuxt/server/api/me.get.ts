// The signed-in user of the layout's header (null when signed out).
export default defineEventHandler((event) => currentUser(event) ?? null);
