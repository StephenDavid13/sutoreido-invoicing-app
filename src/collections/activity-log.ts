import type { CollectionConfig } from 'payload'

import { isAdmin, isOwnerOrAdmin } from '@/lib/access'
import { ownerField } from '@/lib/fields/owner'

/**
 * Immutable audit trail, ported from the predecessor's StateTransitionLog.
 *
 * Every status change writes exactly one row, in the same transaction as the
 * change itself, so status and audit commit together or not at all. There is no
 * code path that mutates a status without writing here.
 *
 * Rows are never updatable and only an admin may delete them.
 */
export const ActivityLog: CollectionConfig = {
  slug: 'activity-log',
  admin: {
    useAsTitle: 'summary',
    defaultColumns: ['entityType', 'fromStatus', 'toStatus', 'occurredAt'],
    group: 'System',
    description: 'Append-only. Records every status transition, including forced ones.',
  },
  access: {
    read: isOwnerOrAdmin,
    // Written by hooks running with elevated access, never by a client.
    create: () => false,
    update: () => false,
    delete: isAdmin,
  },
  fields: [
    ownerField,
    {
      name: 'summary',
      type: 'text',
      admin: { readOnly: true, description: 'Human-readable one-liner for the admin list view.' },
    },
    {
      name: 'entityType',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Invoice', value: 'invoice' },
        { label: 'Quote', value: 'quote' },
      ],
    },
    { name: 'entityId', type: 'text', required: true, index: true },
    { name: 'entityNumber', type: 'number' },
    { name: 'fromStatus', type: 'text', required: true },
    { name: 'toStatus', type: 'text', required: true },
    {
      name: 'isAdminOverride',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'True when the transition skipped the state machine. A reason is mandatory in that case.',
      },
    },
    { name: 'reason', type: 'text', maxLength: 500 },
    { name: 'actor', type: 'relationship', relationTo: 'users' },
    { name: 'occurredAt', type: 'date', required: true, index: true },
  ],
  timestamps: true,
}
