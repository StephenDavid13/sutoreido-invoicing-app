import React from 'react'

import type { ArchiveStanding } from '@/lib/archive/queries'
import { formatMoneyExplicit } from '@/lib/money/money'

/**
 * Aging of what is unpaid, as courses stepping right, PER CURRENCY.
 *
 * Never one set of buckets across currencies: an AUD balance and an NZD balance
 * have no common total without a recorded rate, so each currency gets its own
 * courses under its own heading.
 *
 * The buckets are an ordered scale, so this is an ordinal ramp in one hue rather
 * than four categorical colours: older reads lighter against the bench, which is
 * the direction that gains contrast as the number gets worse. The four steps were
 * validated with the ordinal check against this exact surface.
 *
 * Square data-ends, not the 4px rounded ends the chart spec defaults to: the
 * committed world is square stationery with no radius anywhere.
 *
 * When only one bucket carries a figure there is no chart. A one-bar bar chart is
 * a stat tile that has not admitted it.
 */

const STEP = ['var(--age-1)', 'var(--age-2)', 'var(--age-3)', 'var(--age-4)', 'var(--ink-3)']

function CurrencyCourses({
  group,
}: {
  group: ArchiveStanding['agingByCurrency'][number]
}) {
  const populated = group.buckets.filter((b) => b.cents > 0)
  if (populated.length === 0) return null

  const max = Math.max(...group.buckets.map((b) => b.cents))

  if (populated.length === 1) {
    const only = populated[0]
    return (
      <p className="text-ink-2 text-[12px] leading-relaxed">
        <span className="text-ink figure font-semibold tabular-nums">
          {formatMoneyExplicit(only.cents, group.currency)}
        </span>{' '}
        {only.label === 'undated' ? 'has no due date' : `is ${only.label} days out`}.
      </p>
    )
  }

  return (
    <div>
      <h4 className="text-ink-3 mb-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
        {group.currency}
      </h4>
      <ul className="space-y-[6px]">
        {group.buckets.map((bucket, index) => {
          const share = max > 0 ? bucket.cents / max : 0
          return (
            <li key={bucket.label} className="flex items-center gap-2.5">
              <span className="text-ink-3 figure w-[3.6rem] shrink-0 text-[11px] tabular-nums">
                {bucket.label}
              </span>
              <span className="relative block h-[9px] min-w-0 flex-1">
                <span
                  className="absolute inset-y-0 left-0 block"
                  style={{
                    width: `${Math.max(share * 100, bucket.cents > 0 ? 1.5 : 0)}%`,
                    background: STEP[index] ?? STEP[4],
                  }}
                />
              </span>
              <span
                className={`figure shrink-0 text-right text-[11px] tabular-nums ${
                  bucket.cents > 0 ? 'text-ink' : 'text-ink-3'
                }`}
              >
                {bucket.cents > 0 ? formatMoneyExplicit(bucket.cents, group.currency) : '—'}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function AgingCourses({
  agingByCurrency,
}: {
  agingByCurrency: ArchiveStanding['agingByCurrency']
}) {
  const groups = agingByCurrency.filter((g) => g.buckets.some((b) => b.cents > 0))
  if (groups.length === 0) return null

  return (
    <div>
      <h3 className="text-ink-2 mb-3 text-[11px] font-semibold uppercase tracking-[0.14em]">
        Aging of unpaid
      </h3>
      <div className="space-y-4">
        {groups.map((group) => (
          <CurrencyCourses key={group.currency} group={group} />
        ))}
      </div>
    </div>
  )
}
