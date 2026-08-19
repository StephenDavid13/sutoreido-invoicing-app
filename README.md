# Sutoreido

Invoicing, recurring billing and project management for a freelance business — built to replace a hand-maintained Google Docs → PDF workflow with something that raises its own invoices, chases them, and knows when a domain is about to lapse.

Next.js 16 · PayloadCMS 3 · PostgreSQL · TypeScript

---

## Why it exists

Freelance invoicing tools are either too thin (a PDF generator) or too heavy (full accounting suites priced per seat). This sits in between, and is opinionated about the parts that actually cause problems:

- **Recurring hosting and maintenance** is the closest thing a web freelancer has to MRR, and it's the easiest thing to forget to bill.
- **Money must be exact.** Every amount is an integer number of minor units, rounded once, at a defined point.
- **An invoice is a legal document.** Once sent, it must not silently change, and it must not claim to be something it isn't.

## Features

**Working**

- Clients with per-client currency, payment terms and quantity-column labels
- Invoices with a state machine (`draft → sent → paid | overdue | cancelled`), an immutable audit trail, and line items frozen once sent
- Atomic per-owner invoice numbering, allocated on send so drafts never consume a number
- PDF rendering with a data-driven column layout, from a serialisable model
- Recurring services with cost tracking, monthly margin, and renewal reminders
- An idempotent billing run, exposed as a CLI command and a cron endpoint
- Australian GST compliance: a `gstRegistered` flag drives the document title, the tax row and the rate
- Multi-currency (AUD / NZD / USD / PHP) with unambiguous formatting
- Payments with part payments, so an invoice keeps a real balance until covered
- A deliberate send action: issue, archive the PDF immutably, email it with the PDF attached
- A daily sweep that marks invoices overdue and **prepares** reminders for you to send
- An outbound delivery guard that redirects all mail while testing

**Planned**

A `/today` surface for what needs attention · quotes and quote→invoice conversion · projects, kanban and time tracking · client logins

## Tech stack

| | |
|---|---|
| Framework | Next.js 16.2.6 (App Router, Turbopack) |
| Backend | PayloadCMS 3.87.1 — schema, auth, access control, admin panel |
| Database | PostgreSQL 16 via `@payloadcms/db-postgres` (Drizzle) |
| PDF | `@react-pdf/renderer` 4.5.1 |
| UI | React 19.2, Tailwind v4 (CSS-first), shadcn/ui conventions |
| Language | TypeScript, `strict` |

> **Versions are pinned deliberately.** `@payloadcms/next` declares Next as a *discontinuous allowlist* — `>=16.2.6 <17` — and React `>=19.2.1` (19.2.0 is excluded). Next 15.5–16.1.x will never be supported. Check `@payloadcms/next`'s peer range before upgrading either.

## Architecture

Payload and the custom UI live in one Next app as **sibling route groups with separate root layouts**:

```
src/
├── app/
│   ├── (app)/                  custom UI — owns /api/*, imports Tailwind
│   │   ├── api/cron/bill/       daily billing run (Vercel Cron)
│   │   └── api/invoices/[id]/pdf
│   └── (payload)/              admin panel — SCSS only
│       ├── admin/
│       └── payload-api/         Payload's REST catch-all, moved off /api
├── collections/                clients, invoices, services, …
├── globals/                    business settings, invoice defaults
├── lib/
│   ├── auth/dal.ts             the only module allowed to call getPayload()
│   ├── invoices/               numbering, totals, state machine
│   ├── money/                  integer-minor-unit arithmetic
│   ├── pdf/                    document tree + render model
│   └── services/               period arithmetic, billing run
└── migrations/                 generated; never hand-edited
```

There is deliberately **no `src/app/layout.tsx`**. Two root layouts is what keeps Tailwind's preflight out of the admin panel — Next only ships the CSS imported by the rendered tree.

### Decisions worth explaining

**Payload's Local API defaults `overrideAccess` to `true`.** A bare `payload.find()` in a server component runs with access control *switched off* and no user, silently bypassing every `access` function. It fails open. So nothing under `src/app/(app)` may import `getPayload` — everything goes through `src/lib/auth/dal.ts`, which always passes `overrideAccess: false` and a resolved user. An ESLint rule enforces it, and the two legitimate unscoped callers (the public portal, background jobs) use a deliberately awkward named escape hatch.

**Money is integer minor units in Payload `number` fields.** Payload's `number` compiles to unconstrained Postgres `numeric` — exact arbitrary-precision decimal — so an integer round-trips exactly. Forcing `bigint` would desynchronise drizzle-kit's snapshot diffing and return strings from node-postgres, for no benefit. Rounding happens **once, per line**; the subtotal is the plain sum of already-rounded line totals and is never re-rounded, so the Total column always adds up to the amount due.

**The admin UI never exposes storage units.** A custom field component accepts dollars and hours and writes the scaled integer to form state. Nobody should type `15000` to mean `$150`.

**Billing dates are anchored, never incremented.** The next date is always `startDate + (n × period)`. Adding a month repeatedly walks a 31st-of-the-month service backwards permanently (31 Jan → 28 Feb → 28 Mar → …). All of it is UTC — `date-fns` operates in local time by design, which shifts a day-only billing date across a timezone boundary.

**The billing run is idempotent.** A unique index on `(service, periodStart)` means a repeated, double-fired or missed run cannot double-invoice; the run queries by date window rather than "what changed since yesterday", so a skipped day self-heals. Generated invoices are drafts, and numbers are allocated on send, so a failed run cannot burn a number.

**Foreign-currency costs are excluded from margin, not converted.** No FX rate is recorded, and a confidently wrong margin is worse than an absent one. For the same reason the reports never sum AUD and NZD into one figure.

**Tax compliance is encoded, not documented.** While `gstRegistered` is off, the document is titled `INVOICE` (never `TAX INVOICE`) and carries no tax row at all — not even `TAX $0.00`, which would imply GST was charged. The flag is frozen per invoice at issue time, so registering later never retroactively relabels a document already sent.

## Getting started

**Prerequisites** — Node 24 (`.nvmrc` provided), PostgreSQL 16, npm.

```bash
nvm use
npm install

createdb sutoreido_dev
createdb sutoreido_shadow          # used only to generate migrations

cp .env.example .env
# set PAYLOAD_SECRET and DATABASE_URI
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

npm run dev                        # http://localhost:3000  ·  admin at /admin
npm run seed                       # demo business, clients and a hosting service
npm run bill                       # raise the first recurring invoice
```

### Commands

| | |
|---|---|
| `npm run dev` | dev server (schema syncs via Drizzle `push`) |
| `npm run seed` | fictional demo data; override with `SEED_*` in `.env` |
| `npm run bill` | billing run — `DRY_RUN=1` and `AS_AT=YYYY-MM-DD` supported |
| `npm run verify` | asserts the invoicing invariants at runtime |
| `npm run render:pdf -- <id>` | render an invoice PDF to `tmp/pdf/` |
| `npm run db:check` | show which env var supplied the connection string |
| `npm run typecheck` / `lint` | `tsc --noEmit` / ESLint |
| `npm run migrate:status` | which migrations have run against the current database |
| `npm run migrate:create <name>` | generate a migration (point at the shadow DB) |
| `npm run ci` | `payload migrate && next build` |

### Migrations

Development uses Drizzle **`push`**; production uses **migrations**. Never both on one database — `push` writes a `payload-migrations` row with batch `-1`, and `migrate` then warns that data loss will occur. Generate against the shadow database:

```bash
DATABASE_URI=$DATABASE_URI_SHADOW npm run migrate:create my-change
```

## Deployment

See **[docs/DEPLOY.md](docs/DEPLOY.md)** for the full Vercel walkthrough. In short: a hosted Postgres, four environment variables, `npm run ci` as the build command, and a region matched to the database.

## Notes

- **Uploads need a storage adapter in production.** The `media` collection writes to the local filesystem, which is ephemeral and read-only on serverless hosts. Add `@payloadcms/storage-vercel-blob` or `storage-s3` before relying on logo uploads or archived PDFs.
- **`scripts/seed.ts` contains only fictional data**, because it is committed. Real business details belong in `.env` (gitignored) or entered through the admin panel.
- Nothing here is tax advice. The GST rules encoded are the published ATO ones; cross-border treatment is worth an accountant's twenty minutes.

## License

UNLICENSED — all rights reserved.
