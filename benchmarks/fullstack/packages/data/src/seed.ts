import { mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { INDEXES, SCHEMA, closeDb, transaction } from "./db.ts";
import { PRIORITIES, type Priority, type Status } from "./types.ts";

export const SEED_COUNTS = { users: 200, projects: 12, labels: 15, issues: 6000, comments: 30000 };

/** The seed's "now": every generated timestamp is before it. */
export const SEED_NOW = Date.UTC(2026, 8, 1);

const DAY = 86_400_000;

const FIRST_NAMES = [
  "alice",
  "bob",
  "carol",
  "dave",
  "erin",
  "frank",
  "grace",
  "heidi",
  "ivan",
  "judy",
  "mallory",
  "niaj",
  "olivia",
  "peggy",
  "quentin",
  "rupert",
  "sybil",
  "trent",
  "uma",
  "victor",
  "walter",
  "xena",
  "yusuf",
  "zoe",
  "amir",
  "bea",
  "chen",
  "dina",
  "emil",
  "fatima",
  "goran",
  "hana",
  "igor",
  "jun",
  "kofi",
  "lena",
  "marco",
  "nora",
  "omar",
  "priya",
];
const LAST_NAMES = [
  "Anderson",
  "Brown",
  "Clark",
  "Diaz",
  "Evans",
  "Fischer",
  "Garcia",
  "Hughes",
  "Ito",
  "Jensen",
  "Khan",
  "Lopez",
  "Moreau",
  "Novak",
  "Okafor",
  "Park",
  "Quinn",
  "Rossi",
  "Silva",
  "Tanaka",
];

const PROJECTS: [slug: string, name: string, description: string][] = [
  ["web-app", "Web App", "The customer-facing web application."],
  ["mobile", "Mobile", "iOS and Android clients."],
  ["api", "API", "Public REST API and webhooks."],
  ["billing", "Billing", "Plans, invoices and payment providers."],
  ["auth", "Auth", "Sign-in, sessions and permissions."],
  ["search", "Search", "Indexing and query service."],
  ["notifications", "Notifications", "Email, push and in-app notifications."],
  ["analytics", "Analytics", "Event pipeline and reports."],
  ["design-system", "Design System", "Shared components and tokens."],
  ["infra", "Infrastructure", "Clusters, CI and deployments."],
  ["docs", "Docs", "Guides, reference and examples."],
  ["integrations", "Integrations", "Third-party connectors."],
];

const LABELS: [name: string, color: string][] = [
  ["bug", "#d73a4a"],
  ["feature", "#0e8a16"],
  ["docs", "#0075ca"],
  ["performance", "#fbca04"],
  ["security", "#b60205"],
  ["ui", "#c5def5"],
  ["api", "#5319e7"],
  ["refactor", "#bfdadc"],
  ["test", "#d4c5f9"],
  ["build", "#e99695"],
  ["accessibility", "#006b75"],
  ["i18n", "#f9d0c4"],
  ["regression", "#ff7619"],
  ["good-first-issue", "#7057ff"],
  ["question", "#d876e3"],
];

const VERBS = [
  "Fix",
  "Improve",
  "Add",
  "Remove",
  "Refactor",
  "Investigate",
  "Update",
  "Support",
  "Document",
  "Speed up",
];
const SUBJECTS = [
  "the login flow",
  "CSV export",
  "dashboard charts",
  "the settings page",
  "password reset emails",
  "webhook retries",
  "the search index",
  "invoice PDFs",
  "dark mode",
  "keyboard shortcuts",
  "the onboarding wizard",
  "file uploads",
  "rate limiting",
  "audit logs",
  "team invitations",
  "the billing portal",
  "push notifications",
  "date pickers",
  "the API pagination",
  "error pages",
  "session timeouts",
  "the release pipeline",
  "image thumbnails",
  "the mobile menu",
  "SSO with SAML",
  "user avatars",
  "the activity feed",
  "bulk actions",
  "table sorting",
  "the import wizard",
];
const QUALIFIERS = [
  "",
  "",
  "",
  "on Safari",
  "for large projects",
  "after the last upgrade",
  "on slow networks",
  "in the admin area",
  "for new users",
  "when offline",
  "on Android",
  "with screen readers",
  "in Firefox",
  "for enterprise plans",
  "behind a proxy",
];
const WORDS = (
  "the a when we users report that page loads slowly error appears after clicking button form " +
  "submit request returns status code server logs show timeout cache invalid state component " +
  "renders twice data missing field value expected actual steps reproduce open browser console " +
  "network tab shows response header token expired session cookie redirect loop mobile layout " +
  "breaks narrow screen scroll position resets filter list table column width overflow label " +
  "translation missing locale fallback query slow index database migration rollback deploy " +
  "staging production environment config flag feature toggle customer ticket support priority " +
  "regression since version release notes workaround refresh retry later dependency upgrade"
).split(" ");

function mulberry32(initial: number): () => number {
  let a = initial >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generator(initial: number) {
  const random = mulberry32(initial);
  const int = (n: number) => Math.floor(random() * n);
  const pick = <T>(items: readonly T[]): T => items[int(items.length)]!;
  const sentence = () => {
    const words = Array.from({ length: 6 + int(10) }, () => pick(WORDS));
    const text = words.join(" ");
    return text[0]!.toUpperCase() + text.slice(1) + ".";
  };
  const text = (minLength: number) => {
    let out = "";
    while (out.length < minLength) out += (out ? " " : "") + sentence();
    return out;
  };
  return { random, int, pick, sentence, text };
}

function weighted<T>(random: () => number, table: [T, number][]): T {
  let r = random();
  for (const [value, weight] of table) {
    if (r < weight) return value;
    r -= weight;
  }
  return table[table.length - 1]![0];
}

const iso = (ms: number) => new Date(ms).toISOString();

/**
 * Rebuilds the database at `path` with the deterministic Tracker dataset
 * (doc-4 §2). The same seed always produces the same rows and ids.
 */
export function seed(path: string, seedValue = 20261009): void {
  closeDb();
  mkdirSync(dirname(path), { recursive: true });
  for (const suffix of ["", "-wal", "-shm"]) rmSync(path + suffix, { force: true });

  const g = generator(seedValue);
  const conn = new DatabaseSync(path);
  conn.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = OFF;");
  conn.exec(SCHEMA);

  transaction(conn, () => {
    const insertUser = conn.prepare("INSERT INTO users (id, name, display_name) VALUES (?, ?, ?)");
    for (let i = 0; i < SEED_COUNTS.users; i++) {
      const first = FIRST_NAMES[i % FIRST_NAMES.length]!;
      const round = Math.floor(i / FIRST_NAMES.length);
      const name = round === 0 ? first : `${first}${round + 1}`;
      const last = LAST_NAMES[(i * 7 + round) % LAST_NAMES.length]!;
      insertUser.run(i + 1, name, `${first[0]!.toUpperCase()}${first.slice(1)} ${last}`);
    }

    const insertProject = conn.prepare(
      "INSERT INTO projects (id, slug, name, description) VALUES (?, ?, ?, ?)",
    );
    PROJECTS.forEach(([slug, name, description], i) =>
      insertProject.run(i + 1, slug, name, description),
    );

    const insertLabel = conn.prepare("INSERT INTO labels (id, name, color) VALUES (?, ?, ?)");
    LABELS.forEach(([name, color], i) => insertLabel.run(i + 1, name, color));

    // Issues are numbered in creation order.
    const issues = Array.from({ length: SEED_COUNTS.issues }, () => {
      const createdAt = SEED_NOW - 1 - g.int(365 * DAY);
      const updatedAt = createdAt + g.int(Math.min(60 * DAY, SEED_NOW - 1 - createdAt));
      return { createdAt, updatedAt };
    }).toSorted((a, b) => a.createdAt - b.createdAt);

    const insertIssue = conn.prepare(
      `INSERT INTO issues (id, project_id, title, body, status, priority, priority_rank,
         assignee_id, reporter_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertIssueLabel = conn.prepare(
      "INSERT INTO issue_labels (issue_id, label_id) VALUES (?, ?)",
    );
    issues.forEach(({ createdAt, updatedAt }, i) => {
      const id = i + 1;
      const qualifier = g.pick(QUALIFIERS);
      const title = `${g.pick(VERBS)} ${g.pick(SUBJECTS)}${qualifier ? ` ${qualifier}` : ""}`;
      const body = [g.text(160), g.text(160), g.text(120)].join("\n\n");
      const status = weighted<Status>(g.random, [
        ["open", 0.4],
        ["in_progress", 0.2],
        ["closed", 0.4],
      ]);
      const priority = weighted<Priority>(g.random, [
        ["low", 0.3],
        ["medium", 0.4],
        ["high", 0.2],
        ["urgent", 0.1],
      ]);
      const assignee = g.random() < 0.1 ? null : 1 + g.int(SEED_COUNTS.users);
      insertIssue.run(
        id,
        1 + g.int(SEED_COUNTS.projects),
        title,
        body,
        status,
        priority,
        PRIORITIES.indexOf(priority),
        assignee,
        1 + g.int(SEED_COUNTS.users),
        iso(createdAt),
        iso(updatedAt),
      );
      const labelIds = new Set<number>();
      const labelCount = g.int(4);
      while (labelIds.size < labelCount) labelIds.add(1 + g.int(SEED_COUNTS.labels));
      for (const labelId of [...labelIds].toSorted((a, b) => a - b))
        insertIssueLabel.run(id, labelId);
    });

    const comments = Array.from({ length: SEED_COUNTS.comments }, () => {
      const issueIndex = g.int(SEED_COUNTS.issues);
      const { createdAt } = issues[issueIndex]!;
      return { issueId: issueIndex + 1, createdAt: createdAt + g.int(SEED_NOW - 1 - createdAt) };
    }).toSorted((a, b) => a.createdAt - b.createdAt || a.issueId - b.issueId);

    const insertComment = conn.prepare(
      "INSERT INTO comments (id, issue_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)",
    );
    comments.forEach(({ issueId, createdAt }, i) => {
      insertComment.run(
        i + 1,
        issueId,
        1 + g.int(SEED_COUNTS.users),
        g.text(40 + g.int(200)),
        iso(createdAt),
      );
    });
  });

  conn.exec(INDEXES);
  conn.exec("ANALYZE; PRAGMA wal_checkpoint(TRUNCATE);");
  conn.close();
}
