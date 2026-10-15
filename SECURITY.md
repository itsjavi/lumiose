# Security policy

## Reporting a vulnerability

Report vulnerabilities privately through GitHub: open the repository's **Security** tab and choose
**Report a vulnerability**. Please do not open a public issue, discussion or pull request for a
security problem.

Include what you can of:

- the affected package (`lumiose`, an `@lumiose/*` package or the compiler binaries) and version;
- the impact, and who can trigger it (any visitor, a signed-in user, the app's own code);
- steps or a minimal project that reproduces it.

## What to expect

- An acknowledgement within 7 days.
- An assessment within 14 days: whether it is a vulnerability, its severity, and a plan.
- A fix in a new release of the supported version, published with a GitHub security advisory (and a
  CVE when it applies). Reporters are credited unless they prefer not to be.

Lumiose is maintained by one person, so these are targets rather than guarantees; you will hear
back either way.

## Supported versions

Until 1.0, only the latest minor release receives security fixes: upgrade to it to get them.

| Version            | Security fixes |
| ------------------ | -------------- |
| Latest 0.x minor   | Yes            |
| Older 0.x releases | No             |

## Scope

In scope: the `lumiose` package and every published `@lumiose/*` package, including the compiler's
native and WebAssembly builds, and the code `create-lumiose` scaffolds.

Out of scope: the example apps, benchmarks and evals in this repository, and vulnerabilities in
third-party dependencies that do not affect Lumiose (report those upstream).

## How Lumiose is checked

- Packages are published from CI with npm provenance and trusted publishing.
- Every night, cargo-fuzz targets fuzz the compiler's scanner, JSX transform and SSR codegen, and
  property tests run body parsing, the Origin check, redirect targets and unsafe-URL escaping with
  hundreds of thousands of cases (`.github/workflows/fuzz.yml`).
- A security review of the request handler, form actions, the Origin check, body parsing, the
  sanitizers and SSR escaping runs before each minor release; an independent external review is a
  criterion for 1.0.
