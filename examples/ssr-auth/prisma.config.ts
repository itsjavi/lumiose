// The Prisma CLI's configuration (`prisma generate`, `prisma migrate`). It reads DATABASE_URL from
// the environment, with the same default as src/server/db.server.ts.
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? "file:./data/auth.db" },
});
