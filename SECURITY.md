# Security policy

## Reporting a vulnerability

Report vulnerabilities privately through GitHub:
[open a private security advisory](https://github.com/renzfeliciano/trask/security/advisories/new).

Do not open a public issue, pull request or discussion for a suspected vulnerability. Include what you found, how to reproduce it, and which version or commit you tested.

## What to expect

- We acknowledge your report within 7 days.
- We keep you updated while we investigate and fix it, and tell you when a fix ships.
- We credit you in the advisory if you want to be named.

## Coordinated disclosure

Please do not disclose the issue publicly before a fix is released. If a report has had no response after 7 days, you may nudge on the same advisory thread.

## Scope

In scope:

- The TRASK application in this repository, including its API routes, Server Actions and authentication and authorization logic (workspace isolation, role checks, row-level security).
- The configuration shipped in this repository: security headers, CI workflows, and database setup scripts.

Out of scope:

- Findings that need a compromised device, browser extension or an already-privileged account.
- Denial of service through volume (rate and traffic flooding).
- Vulnerabilities in third-party services we depend on (Vercel, Neon, GitHub). Report those to the vendor.
- Missing best-practice headers or flags on pages that carry no session or user data.
- Reports from automated scanners without a demonstrated impact.

## Supported versions

Only the latest commit on `main` is supported. Fixes land on `main` and are deployed from there.

## Machine-readable contact

The same contact is published at `/.well-known/security.txt`.
