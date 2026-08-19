import type { ReminderRule } from '@/payload-types'

/** "-3, 0, 7, 21" -> [-3, 0, 7, 21], de-duplicated and ordered. */
export function parseOffsets(raw: string | null | undefined): number[] {
  if (!raw) return []
  const parsed = raw
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= -365 && n <= 365)
  return [...new Set(parsed)].sort((a, b) => a - b)
}

/**
 * A client-specific rule REPLACES the fallback rather than merging with it.
 *
 * Merging would mean a client you deliberately gave a gentler cadence still
 * inherits the default's firmer offsets, which is the opposite of the intent.
 */
export function resolveRule(
  rules: ReminderRule[],
  clientId: number,
): ReminderRule | null {
  const specific = rules.find(
    (r) => r.client && (typeof r.client === 'object' ? r.client.id : r.client) === clientId,
  )
  if (specific) return specific.enabled ? specific : null
  const fallback = rules.find((r) => !r.client)
  return fallback?.enabled ? fallback : null
}

/** The label an offset is filed under. Unique per invoice, so it is the dedupe key. */
export const offsetKind = (offset: number): string =>
  offset === 0 ? 'due' : offset < 0 ? `${offset}` : `+${offset}`
