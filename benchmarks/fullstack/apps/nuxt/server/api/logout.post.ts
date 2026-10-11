export default defineEventHandler((event) => {
  endSession(event);
  return { ok: true };
});
