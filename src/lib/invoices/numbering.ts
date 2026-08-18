import { sql } from 'drizzle-orm'
import { APIError } from 'payload'
import type { PayloadRequest } from 'payload'
import type { DrizzleAdapter } from '@payloadcms/drizzle/types'

export type SequenceKind = 'invoice' | 'quote'

/**
 * Invoices #1 to #5 were issued by hand from Google Docs, so the first number
 * this app allocates must be 6. Change only if the historical series changes.
 */
export const SEED_LAST_VALUE: Record<SequenceKind, number> = {
  invoice: 5,
  quote: 0,
}

/**
 * Allocates the next document number atomically.
 *
 * This is one statement. It runs on the caller's transaction, so if the invoice
 * insert later fails, the number is rolled back with it and no gap appears in
 * the ATO-visible sequence.
 *
 * Both of the predecessor's defects are fixed here:
 *
 *   1. Its `SELECT ... FOR UPDATE` locked nothing when the row did not yet
 *      exist, so two concurrent first-ever allocations both inserted
 *      last_value = 1 and one died on the primary key. `ON CONFLICT` has no
 *      such gap — the unique index `owner_kind_idx` on (owner_id, kind)
 *      serialises the insert and the update through the same path.
 *
 *   2. It called BeginTransaction on its own, committed the number, and only
 *      then inserted the invoice — so any later failure burned the number.
 *      Here the number and the invoice share one transaction.
 *
 * Column and index names below were read off the migrated schema, not assumed:
 *   number_sequences(owner_id integer, kind enum_number_sequences_kind,
 *                    last_value numeric, created_at, updated_at)
 *   "owner_kind_idx" UNIQUE, btree (owner_id, kind)
 */
export async function allocateNextNumber(args: {
  req: PayloadRequest
  ownerId: number | string
  kind: SequenceKind
}): Promise<number> {
  const { req, ownerId, kind } = args
  const adapter = req.payload.db as unknown as DrizzleAdapter

  // Join the request's transaction when there is one, so this is atomic with
  // the invoice write. Falls back to the pool for out-of-transaction callers.
  const txId = req.transactionID ? String(req.transactionID) : undefined
  const db = (txId && adapter.sessions?.[txId]?.db) || adapter.drizzle

  const firstValue = SEED_LAST_VALUE[kind] + 1

  const result = (await adapter.execute({
    db,
    sql: sql`
      INSERT INTO number_sequences (owner_id, kind, last_value, created_at, updated_at)
      VALUES (${ownerId}, ${kind}::enum_number_sequences_kind, ${firstValue}, now(), now())
      ON CONFLICT (owner_id, kind)
      DO UPDATE SET last_value = number_sequences.last_value + 1, updated_at = now()
      RETURNING last_value
    `,
  })) as { rows?: Array<{ last_value: string | number }> }

  const raw = result?.rows?.[0]?.last_value
  // last_value is Postgres `numeric`, which node-postgres returns as a string.
  const next = typeof raw === 'string' ? Number.parseInt(raw, 10) : raw

  if (!Number.isInteger(next) || (next as number) < 1) {
    throw new APIError('Could not allocate an invoice number.', 500)
  }

  return next as number
}
