// The server sends a shell; the browser renders this page (and the layout around it).
export const ssr = false;

export default function ClientRendered() {
  return <h1 id="csr">rendered in {typeof window === "undefined" ? "node" : "the browser"}</h1>;
}
