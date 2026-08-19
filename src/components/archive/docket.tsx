import React from 'react'

import type { DocketEntry } from '@/lib/archive/queries'
import { formatMoneyExplicit } from '@/lib/money/money'
import { dateDDMMYYYY } from '@/lib/pdf/format'

import { MarkedText, StatusMark } from './marks'

/**
 * The docket: every filing against the open matter, newest first.
 *
 * Rows, ruled by hairlines. No cards, and no card inside a card. Each row leads
 * with its reference because that is the record's identity, and gives the most
 * horizontal room to what the work was, because that is what gets remembered and
 * therefore searched.
 *
 * Two links per filing, which is the brief: the document, readable as a web page
 * and shareable with the client, and the PDF.
 */
export function Docket({
  entries,
  query,
  showClient,
}: {
  entries: DocketEntry[]
  query?: string
  showClient: boolean
}) {
  return (
    <ol className="divide-rule divide-y">
      {entries.map((entry, index) => (
        <li
          key={entry.id}
          className="course-step hover:bg-bench-course grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-5 py-4 transition-colors md:grid-cols-[5.5rem_1fr_auto] md:items-baseline md:gap-x-6"
          style={{ animationDelay: `${Math.min(index, 12) * 14}ms` }}
        >
          {/* Reference. The record's identity, set in the display face. */}
          <span className="figure text-ink text-[15px] font-semibold tabular-nums md:text-[17px]">
            {entry.reference === 'Draft' ? (
              <span className="text-ink-3 text-[13px] font-normal">no ref</span>
            ) : (
              <>#{entry.reference}</>
            )}
          </span>

          <div className="min-w-0">
            <p className="text-ink text-[15px] leading-snug">
              <MarkedText text={entry.work || entry.title || 'No description'} query={query} />
            </p>
            <p className="text-ink-3 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
              {showClient ? (
                <span className="text-ink-2">
                  <MarkedText text={entry.clientName} query={query} />
                </span>
              ) : null}
              <span className="figure tabular-nums">
                {entry.issuedDate ? dateDDMMYYYY(entry.issuedDate) : 'unissued'}
              </span>
              <StatusMark entry={entry} />
            </p>
          </div>

          <div className="col-span-2 flex items-baseline justify-between gap-5 md:col-span-1 md:justify-end">
            <span
              className={`figure text-[15px] tabular-nums md:text-[16px] ${
                entry.status === 'cancelled' ? 'mark-struck' : 'text-ink'
              }`}
            >
              {formatMoneyExplicit(entry.totalCents, entry.currency)}
            </span>

            <span className="flex shrink-0 items-baseline gap-4 text-[12px] font-semibold uppercase tracking-[0.1em]">
              {entry.shareToken ? (
                <a
                  href={`/i/${entry.shareToken}`}
                  className="text-ink-2 hover:text-ink underline decoration-1 transition-colors"
                >
                  Document
                </a>
              ) : (
                <span className="text-ink-3" title="A draft has no shareable document yet">
                  Document
                </span>
              )}
              <a
                href={`/api/invoices/${entry.id}/pdf`}
                className="text-ink-2 hover:text-ink underline decoration-1 transition-colors"
              >
                PDF
              </a>
            </span>
          </div>
        </li>
      ))}
    </ol>
  )
}
