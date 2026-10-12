import lumiose from "@lumiose/vite";

export default {
  // Pages that show the signed-in user render per request; the home page opts into "static".
  plugins: [lumiose({ mode: "server" })],
};
