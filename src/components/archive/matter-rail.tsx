import Link from 'next/link'
import React from 'react'

import type { MatterTab } from '@/lib/archive/queries'
import { formatMoneyExplicit } from '@/lib/money/money'

import { MarkedText } from './marks'

/**
 * The tab rail: the archive's spine, one gummed tab per client.
 *
 * Rank is carried by inversion, not by size or weight. The open matter's tab is
 * the only pale plate on the bench, so which file is open is legible from across
 * the room without reading a word.
 *
 * Tabs with no hits under an active query are dimmed rather than removed, because
 * the rail is the roster: hiding a client would make it lie about who exists.
 */
export function MatterRail({
  tabs,
  activeClientId,
  query,
}: {
  tabs: MatterTab[]
  activeClientId: number | null
  query?: string
}) {
  const searching = Boolean(query?.trim())

  // min-h-0 is what lets the nav scroll inside the flex column rather than
  // growing past it and pushing the foot out of view.
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav aria-label="Clients" className="min-h-0 flex-1 px-2 py-2 md:overflow-y-auto">
      <Link
        href={query ? `/?view=all&q=${encodeURIComponent(query)}` : '/?view=all'}
        aria-current={activeClientId === null ? 'page' : undefined}
        className={`block px-3 py-2 text-[13px] font-semibold uppercase tracking-[0.1em] transition-colors ${
          activeClientId === null
            ? 'tab-open'
            : 'text-ink-3 hover:text-ink hover:bg-bench-course'
        }`}
      >
        Every filing
      </Link>

      {tabs.map((tab) => {
        const open = tab.clientId === activeClientId
        const dimmed = searching && tab.hits === 0
        const href = query
          ? `/?client=${tab.clientId}&q=${encodeURIComponent(query)}`
          : `/?client=${tab.clientId}`

        return (
          <Link
            key={tab.clientId}
            href={href}
            aria-current={open ? 'page' : undefined}
            className={`group block px-3 py-2.5 transition-colors ${
              open ? 'tab-open' : dimmed ? 'text-ink-3' : 'text-ink hover:bg-bench-course'
            }`}
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[14px] leading-tight">
                <MarkedText text={tab.name} query={open ? undefined : query} />
              </span>
              {searching && tab.hits > 0 && !open ? (
                <span className="text-reserved figure shrink-0 text-[11px] font-semibold tabular-nums">
                  {tab.hits}
                </span>
              ) : null}
            </span>

            {tab.filings > 0 ? (
              <span
                className={`mt-0.5 flex items-baseline justify-between gap-3 text-[11px] tabular-nums ${
                  open ? 'text-plate-ink-2' : 'text-ink-3'
                }`}
              >
                <span className="figure">{tab.filings} filed</span>
                {tab.outstandingCents > 0 ? (
                  <span className="figure shrink-0">
                    {formatMoneyExplicit(tab.outstandingCents, tab.currency)} owing
                  </span>
                ) : null}
              </span>
            ) : null}
          </Link>
          )
        })}
      </nav>

    </div>
  )
}
