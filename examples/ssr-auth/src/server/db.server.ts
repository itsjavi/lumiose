// The Prisma client, on SQLite through the libsql driver adapter. Server-only: it lives in
// src/server (and the generated client under it), so client code that imports it fails the build
// with LUM4003.
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { env } from "lumiose";
import { PrismaClient } from "./generated/prisma/client.ts";

/** The database when DATABASE_URL is unset; prisma.config.ts has the same default. */
export const DEFAULT_DATABASE_URL = "file:./data/auth.db";

let client: PrismaClient | undefined;

/** The app's client, created on first use: `env()` then reads the request's environment. */
export function prisma(): PrismaClient {
  client ??= new PrismaClient({
    adapter: new PrismaLibSql({ url: env("DATABASE_URL") ?? DEFAULT_DATABASE_URL }),
  });
  return client;
}
