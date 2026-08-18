import type { Field } from 'payload'

/**
 * Spread into every tenant-scoped collection.
 *
 * The field-level beforeChange hook is the important part: without it a
 * non-admin could POST `owner: <someone else's id>` and create a row inside
 * another tenant. Collection-level access control does not cover that, because
 * the create passes access checks before the value is inspected.
 */
export const ownerField: Field = {
  name: 'owner',
  type: 'relationship',
  relationTo: 'users',
  required: true,
  index: true,
  defaultValue: ({ user }) => user?.id,
  admin: {
    position: 'sidebar',
    // Only admins ever see the control; for everyone else it is implicit.
    condition: (_data, _siblingData, { user }) => user?.role === 'admin',
  },
  hooks: {
    beforeChange: [
      ({ req, value }) => {
        if (req.user?.role === 'admin') return value
        // Non-admins always own what they create, whatever they sent.
        return req.user?.id ?? value
      },
    ],
  },
}
