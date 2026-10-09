#!/usr/bin/env node
// bench-seed [path]: rebuilds the Tracker database (default: TRACKER_DB or ./.data/tracker.db).
import { resolve } from "node:path";
import { dbPath } from "./db.ts";
import { SEED_COUNTS, seed } from "./seed.ts";

const path = process.argv[2] ? resolve(process.argv[2]) : dbPath();
const start = performance.now();
seed(path);
const c = SEED_COUNTS;
console.log(
  `Seeded ${path}: ${c.users} users, ${c.projects} projects, ${c.issues} issues, ${c.comments} comments ` +
    `in ${Math.round(performance.now() - start)} ms`,
);
