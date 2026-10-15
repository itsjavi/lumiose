import lumiose from "@lumiose/vite";

export default {
  // Pages are prerendered; the endpoints render per request. The chat's WebSockets attach in
  // server.ts, in dev too (`node server.ts --dev`).
  plugins: [lumiose()],
};
