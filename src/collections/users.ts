import type { CollectionConfig } from 'payload'

import { isAdmin, isAdminFieldLevel, isSelfOrAdmin } from '@/lib/access'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['name', 'email', 'role'],
    group: 'System',
  },
  auth: {
    tokenExpiration: 60 * 60 * 24 * 7, // 7 days
    maxLoginAttempts: 5,
    lockTime: 10 * 60 * 1000, // 10 minutes
    cookies: {
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production',
    },
    // Single operator today. Turn on when this becomes multi-user.
    verify: false,
  },
  access: {
    read: isSelfOrAdmin,
    create: isAdmin,
    update: isSelfOrAdmin,
    delete: isAdmin,
    admin: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'user',
      index: true,
      // Available on req.user without a second query, which the access
      // functions in @/lib/access rely on.
      saveToJWT: true,
      options: [
        { label: 'User', value: 'user' },
        { label: 'Admin', value: 'admin' },
      ],
      access: {
        // Nobody promotes themselves.
        update: isAdminFieldLevel,
        create: isAdminFieldLevel,
      },
      admin: { position: 'sidebar' },
    },
    {
      name: 'timezone',
      type: 'select',
      required: true,
      defaultValue: 'Australia/Melbourne',
      options: [
        { label: 'Melbourne', value: 'Australia/Melbourne' },
        { label: 'Sydney', value: 'Australia/Sydney' },
        { label: 'Brisbane', value: 'Australia/Brisbane' },
        { label: 'Perth', value: 'Australia/Perth' },
        { label: 'Auckland', value: 'Pacific/Auckland' },
      ],
      admin: {
        position: 'sidebar',
        description:
          'Drives due-date arithmetic and the daily reminder sweep. A "day only" invoice date must never shift across a UTC boundary.',
      },
    },
    {
      name: 'locale',
      type: 'select',
      required: true,
      defaultValue: 'en-AU',
      options: [
        { label: 'English (Australia)', value: 'en-AU' },
        { label: 'English (New Zealand)', value: 'en-NZ' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'notificationPrefs',
      type: 'group',
      label: 'Notifications',
      fields: [
        { name: 'emailOnInvoicePaid', type: 'checkbox', defaultValue: true },
        { name: 'emailOnInvoiceViewed', type: 'checkbox', defaultValue: true },
        { name: 'emailOnQuoteAccepted', type: 'checkbox', defaultValue: true },
        { name: 'dailyReadyToBillDigest', type: 'checkbox', defaultValue: true },
      ],
    },
  ],
  timestamps: true,
}
