import type { Config } from "@react-router/dev/config";

export default {
  // Server-side rendering on every request; nothing is prerendered (doc-4 §1).
  ssr: true,
} satisfies Config;
