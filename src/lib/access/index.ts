import type { Access, FieldAccess } from 'payload'

/**
 * Tenancy is per-user, matching the predecessor's design (SYSTEM-DESIGN.md §2:
 * "Per-user multi-tenancy instead of organisations... `UserId` -> `OrganisationId`
 * is a non-breaking schema rename if the product grows into team plans").
 *
 * Every tenant-scoped collection carries its own denormalised `owner`
 * relationship, so scoping is always a one-hop `Where` and is never a traversal.
 *
 * Returning a Where clause rather than `false` is deliberate: a non-matching
 * document reads as "not found" rather than "forbidden", so the API never
 * confirms that someone else's invoice exists. The predecessor did the same
 * thing by throwing NotFoundException instead of 403.
 */

export const isAdmin: Access = ({ req: { user } }) => user?.role === 'admin'

export const isAuthenticated: Access = ({ req: { user } }) => Boolean(user)

/** Admins see everything; everyone else sees only rows they own. */
export const isOwnerOrAdmin: Access = ({ req: { user } }) => {
  if (!user) return false
  if (user.role === 'admin') return true
  return { owner: { equals: user.id } }
}

/** Self-or-admin, for the users collection (which has no `owner` field). */
export const isSelfOrAdmin: Access = ({ req: { user } }) => {
  if (!user) return false
  if (user.role === 'admin') return true
  return { id: { equals: user.id } }
}

export const isAdminFieldLevel: FieldAccess = ({ req: { user } }) => user?.role === 'admin'
