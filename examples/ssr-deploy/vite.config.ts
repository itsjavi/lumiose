// One app, built for the platform that DEPLOY_TARGET names (the build:* scripts): cloudflare,
// vercel, vercel-edge or netlify. Without it, the Node build (`lumiose preview`, Bun, Deno).
import { cloudflare } from "@lumiose/adapter-cloudflare";
import { netlify } from "@lumiose/adapter-netlify";
import { vercel } from "@lumiose/adapter-vercel";
import lumiose from "@lumiose/vite";
import { defineConfig } from "vite";

const adapters = {
  cloudflare: () => cloudflare(),
  netlify: () => netlify(),
  vercel: () => vercel(),
  "vercel-edge": () => vercel({ runtime: "edge" }),
};

const target = process.env.DEPLOY_TARGET as keyof typeof adapters | undefined;
if (target !== undefined && !(target in adapters)) {
  throw new Error(`DEPLOY_TARGET must be one of ${Object.keys(adapters).join(", ")}.`);
}

export default defineConfig({
  plugins: [
    lumiose({
      // Nonces per response (Web Crypto on every platform) and hashes in prerendered pages.
      csp: "strict",
      headers: [{ path: "/**", headers: { "x-deploy-check": "1" } }],
      ...(target === undefined ? {} : { adapter: adapters[target]() }),
    }),
  ],
});
