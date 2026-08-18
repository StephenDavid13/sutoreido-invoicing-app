# Deploying to Vercel

Verified against Next 16.2.6, Payload 3.87.1, Node 24. The production build and the
initial migration have both been run locally, so the parts that can be checked
ahead of time are checked.

---

## 0. Before you start

Two things are worth knowing up front, because both are easy to get wrong and
painful to undo.

**Your local `push`-mode database cannot be your production database.** Payload
syncs the schema automatically in development; in production it applies
migrations. Mixing the two on one database triggers a data-loss warning, and
pointing `push` at production can drop tables. Use a separate database for
production, always.

**Uploads will not work until you add a storage adapter.** The `media` collection
writes to the local filesystem, which on Vercel is ephemeral and read-only. Everything
else — invoices, PDFs on demand, the billing run — works without it. See step 8.

---

## 1. Create a Postgres database

Any hosted Postgres works. **Neon** is the easiest fit: it has a Sydney region,
scales to zero, and its database branching solves the "never point dev at prod"
problem directly.

1. Create a project at [neon.tech](https://neon.tech), region **AWS ap-southeast-2 (Sydney)**.
2. Copy the **pooled** connection string. It looks like:
   ```
   postgresql://user:pass@ep-xxx-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require
   ```
3. Keep the **unpooled** string too — useful for running migrations by hand.

Region matters more than usual here. A single Payload admin view fans out into
many round trips, so a database in the US behind functions in Sydney is
noticeably slow. `vercel.json` already pins functions to `syd1`; match your
database to it.

> Use `@payloadcms/db-postgres` (already configured), not `db-vercel-postgres`.
> The Vercel-specific adapter has open issues with large queries and parallel jobs,
> and the generic adapter works fine against Neon's pooled endpoint.

## 2. Push the repo to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin git@github.com:<you>/sutoreido-invoicing-app.git
git push -u origin main
```

`.env` is gitignored, and `scripts/seed.ts` contains only fictional data — verify
with `git grep` before pushing if you've edited either.

## 3. Import into Vercel

New Project → import the repo. Vercel detects Next.js. Then change **one** setting:

| Setting | Value |
|---|---|
| Build Command | `npm run ci` |
| Install Command | *(leave default)* |
| Node.js Version | **24.x** |
| Root Directory | *(leave default)* |

`npm run ci` is `payload migrate && next build` — migrations run **before** the
build, so the schema is ready when the app boots.

> Do not set `prodMigrations` in the Payload config instead. Payload's own docs
> warn it slows serverless cold starts; running migrations as a build step is the
> recommended pattern.

`.npmrc` already sets `legacy-peer-deps=true`, which Vercel respects.

## 4. Environment variables

Add these for **Production** (and Preview, if you use it — pointed at a *different*
database):

| Variable | Value |
|---|---|
| `DATABASE_URI` | your pooled Postgres connection string |
| `PAYLOAD_SECRET` | a fresh 32-byte hex string — **not** your local one |
| `NEXT_PUBLIC_SERVER_URL` | `https://your-domain.vercel.app` |
| `CRON_SECRET` | a fresh random string, ≥16 chars |

Generate the secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # PAYLOAD_SECRET
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"   # CRON_SECRET
```

`PAYLOAD_SECRET` encrypts session tokens. Changing it later logs everyone out;
leaking it is a full compromise. Keep it distinct from local.

## 5. Deploy

Push to `main`, or hit Deploy. Watch the build log for:

```
Migrating: 20260818_102951_initial
Migrated:  20260818_102951_initial
✓ Compiled successfully
```

If migrations fail, the build fails and nothing ships — which is the behaviour you
want.

## 6. Create your first user

The database is empty, so `/admin` shows the create-first-user screen. Visit:

```
https://your-domain.vercel.app/admin
```

Create your account, then fill in **Settings → Business settings**: trading name,
ABN, email, and your bank accounts. These print on every invoice, and the seed data
is deliberately not in production.

Do **not** run `npm run seed` against production.

## 7. Verify the deployment

```bash
# Payload REST answers on its own namespace
curl -s -o /dev/null -w '%{http_code}\n' https://your-domain.vercel.app/payload-api/users/me   # 200

# /api is yours — the PDF route requires auth
curl -s -o /dev/null -w '%{http_code}\n' https://your-domain.vercel.app/api/invoices/1/pdf      # 401

# the cron endpoint rejects unauthenticated callers
curl -s -o /dev/null -w '%{http_code}\n' https://your-domain.vercel.app/api/cron/bill           # 401

# and accepts the secret
curl -s -H "Authorization: Bearer $CRON_SECRET" https://your-domain.vercel.app/api/cron/bill
```

Then in the admin: create a client, create an invoice, mark it **Sent**, and click
**View PDF**. That exercises numbering, the state machine, the audit log and the
renderer in one pass.

## 8. Uploads (required before using the media collection)

Pick one:

```bash
npm i @payloadcms/storage-vercel-blob      # simplest; needs BLOB_READ_WRITE_TOKEN
# or
npm i @payloadcms/storage-s3               # S3, R2, or any S3-compatible store
```

Then add the plugin to `src/payload.config.ts` targeting the `media` collection.
Until you do, uploading a logo or archiving a PDF will fail in production.

## 9. The scheduled billing run

`vercel.json` already declares it:

```json
{ "crons": [{ "path": "/api/cron/bill", "schedule": "0 22 * * *" }] }
```

`0 22 * * *` UTC is roughly 08:00 AEST / 09:00 AEDT. **Cron schedules are always
UTC on Vercel and do not follow daylight saving** — the local time shifts by an
hour twice a year.

Plan limits that matter:

- **Hobby: one run per day, with up to 59 minutes of jitter.** A more frequent
  expression fails at deploy time. For a daily billing sweep this is fine.
- **Pro: per-minute**, if you later want tighter reminder timing.

Vercel cron is explicitly **best effort**: it can fire the same schedule twice and
it can miss a day. The run is built for that — the unique index on
`(service, periodStart)` makes a repeat a no-op, and querying by date window means
a missed day is picked up next time.

Vercel injects `CRON_SECRET` as `Authorization: Bearer <secret>`; the route rejects
anything else.

## 10. Custom domain

Add it under Project → Domains, then update `NEXT_PUBLIC_SERVER_URL` to match and
redeploy. It's used for links in emails and, later, client-portal URLs.

---

## Troubleshooting

**`Migration failed` on build** — check `DATABASE_URI` is the pooled string and
reachable, and that the database is empty on a first deploy. A database that
previously ran in `push` mode carries a batch `-1` row and will refuse to migrate.

**Admin panel unstyled** — `sass` must be installed. It's in `devDependencies`,
which Vercel does install during builds; confirm it wasn't pruned.

**PDF route 500s** — `@react-pdf/renderer` needs the Node runtime, already set via
`export const runtime = 'nodejs'`. It also needs `serverExternalPackages`, already
in `next.config.ts`.

**Connections exhausted** — prefer dynamic rendering for Payload-backed routes.
Payload has a known issue where connections accumulate during static generation;
keep `generateStaticParams` sets small or absent.

**Everything is slow** — check the function region matches the database region.
This is the single biggest lever.
