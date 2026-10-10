import lumiose from "@lumiose/vite";

export default {
  // A strict Content Security Policy: pages rendered per request get a nonce on every inline
  // script and style, and a `Content-Security-Policy` header; the prerendered `(static)` pages
  // allow theirs by hash.
  plugins: [lumiose({ csp: "strict" })],
};
