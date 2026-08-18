/**
 * Resolves the Postgres connection string.
 *
 * Payload's convention is `DATABASE_URI`, but Vercel's database integrations
 * provision different names — the Neon marketplace integration sets
 * `DATABASE_URL`, and Vercel Postgres sets `POSTGRES_URL`. One letter apart from
 * what Payload expects, and easy to miss.
 *
 * When none is set, node-postgres silently falls back to 127.0.0.1:5432, which
 * inside a serverless function produces `ECONNREFUSED 127.0.0.1:5432` — an error
 * that says nothing about the actual problem. So we fail loudly instead.
 */

const CANDIDATES = [
  'DATABASE_URI', // Payload's convention, and what .env.example documents
  'DATABASE_URL', // Neon integration on Vercel
  'POSTGRES_URL', // Vercel Postgres
] as const

export function resolveConnectionString(): string | undefined {
  for (const name of CANDIDATES) {
    const value = process.env[name]?.trim()
    if (value) return value
  }
  return undefined
}

export function missingConnectionStringMessage(): string {
  return (
    `No Postgres connection string found. Set one of ${CANDIDATES.join(', ')}.\n` +
    `On Vercel: Project → Settings → Environment Variables, then REDEPLOY — ` +
    `new variables are not applied to existing deployments.`
  )
}

export function requireConnectionString(): string {
  const found = resolveConnectionString()
  if (found) return found

  // In production a missing database is fatal and should say so. Locally we warn
  // instead, so tooling that does not touch the database still runs.
  if (process.env.NODE_ENV === 'production') throw new Error(missingConnectionStringMessage())

  console.warn(`[db] ${missingConnectionStringMessage()}`)
  return ''
}
