import 'server-only'

import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload, type Payload, type PaginatedDocs, type Where } from 'payload'
import config from '@payload-config'

import type { Config, User } from '@/payload-types'

type CollectionSlug = keyof Config['collections']

/**
 * The data access layer. This is the ONLY module in the app that is allowed to
 * call getPayload(), and an ESLint rule enforces that for everything under
 * src/app/(app).
 *
 * Why it exists
 * -------------
 * Payload's Local API defaults `overrideAccess` to TRUE:
 *
 *   // payload/dist/collections/operations/local/find.d.ts
 *   /** Skip access control. Set to `false` if you want to respect Access
 *    *  Control for the operation... @default true *\/
 *   overrideAccess?: boolean
 *
 * So a bare `payload.find({ collection: 'invoices' })` inside a server component
 * returns EVERY owner's invoices, with no user attached and every `access`
 * function on the collection silently skipped. It fails open, which for a
 * billing app is the worst possible default.
 *
 * Every helper here passes `overrideAccess: false` and a resolved `user`, so
 * access control is the thing that decides what comes back — and the
 * owner-scoping in @/lib/access returns a Where clause, which means another
 * owner's invoice reads as "not found" rather than "forbidden".
 */

let cached: Payload | null = null

async function payloadClient(): Promise<Payload> {
  // getPayload returns a cached instance; Payload's own performance docs say to
  // reuse it rather than re-instantiate per request.
  cached ??= await getPayload({ config })
  return cached
}

export type Session = { payload: Payload; user: User }

/** Resolves the signed-in user, or redirects to the login page. */
export async function requireSession(): Promise<Session> {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: await nextHeaders() })
  // Payload's admin owns the login form; there is no separate app login yet.
  if (!user) redirect('/admin/login')
  return { payload, user: user as User }
}

/** Resolves the signed-in user, or null. For pages that render either way. */
export async function getSession(): Promise<Session | null> {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: await nextHeaders() })
  return user ? { payload, user: user as User } : null
}

type FindArgs = {
  collection: CollectionSlug
  where?: Where
  limit?: number
  page?: number
  sort?: string
  depth?: number
}

/** Access-controlled list. Never returns another owner's rows. */
export async function findScoped<T = unknown>(args: FindArgs): Promise<PaginatedDocs<T>> {
  const { payload, user } = await requireSession()
  return payload.find({
    ...args,
    overrideAccess: false,
    user,
  }) as unknown as Promise<PaginatedDocs<T>>
}

/**
 * Access-controlled read of one document. Resolves to null when the caller does
 * not own it, so callers should render notFound() — never distinguish "missing"
 * from "someone else's".
 */
export async function findByIdScoped<T = unknown>(args: {
  collection: CollectionSlug
  id: string | number
  depth?: number
}): Promise<T | null> {
  const { payload, user } = await requireSession()
  try {
    return (await payload.findByID({
      ...args,
      overrideAccess: false,
      user,
      disableErrors: true,
    })) as T | null
  } catch {
    return null
  }
}

/**
 * ---------------------------------------------------------------------------
 * ESCAPE HATCH — unscoped, access control OFF.
 *
 * Two callers are legitimate:
 *   1. The public invoice portal (/i/[token]), which has no user by definition
 *      and must therefore do its own token check and project an explicit DTO.
 *   2. Background jobs, which run with no request user.
 *
 * Anything else using this is a bug. The name is deliberately awkward so it is
 * obvious in review.
 * ---------------------------------------------------------------------------
 */
export async function getPayloadUnscoped_DANGEROUS(): Promise<Payload> {
  return payloadClient()
}
