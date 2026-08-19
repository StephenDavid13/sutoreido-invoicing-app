import React from 'react'

import type { DocketEntry } from '@/lib/archive/queries'

/**
 * Status as one grammar, not four.
 *
 * Every state is the same impression: the word in caps over a single struck rule,
 * sitting slightly off square the way a hand-held stamp lands. No bordered boxes,
 * because a border is a container and this world does not put state in containers.
 *
 * Only the INK varies, and only to separate "needs you" from "does not":
 *   overdue  -> stamp ink
 *   everything else -> the surrounding ink
 *
 * Sent reads at the same weight as paid. It is the state the whole product exists
 * to act on, so it may not be the quietest thing on the row.
 */

const WORD = 'text-[10px] font-semibold uppercase'

function DraftNotch() {
  // A drawn mark, not a dashed div: an unpunched corner on an unfiled sheet.
  return (
    <svg
      aria-hidden
      viewBox="0 0 10 12"
      className="h-3 w-2.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    >
      <path d="M0.6 0.6h5.6l3.2 3.2v7.6H0.6z" />
      <path d="M6.2 0.6v3.2h3.2" />
    </svg>
  )
}

export function StatusMark({ entry }: { entry: DocketEntry }) {
  const { status, daysOverdue } = entry
  const overdue = status === 'overdue' || (status === 'sent' && daysOverdue > 0)

  if (overdue) {
    return (
      <span
        className={`mark-stamp mark-stamp-urgent text-stamp ${WORD}`}
        aria-label={`Overdue by ${daysOverdue} days`}
      >
        Overdue {daysOverdue}d
      </span>
    )
  }

  if (status === 'paid') {
    return (
      <span className={`mark-stamp text-ink-2 ${WORD}`} aria-label="Paid">
        Paid
      </span>
    )
  }

  if (status === 'sent') {
    return (
      <span className={`mark-stamp text-ink-2 ${WORD}`} aria-label="Sent, not yet paid">
        Sent
      </span>
    )
  }

  if (status === 'cancelled') {
    return (
      <span className={`mark-stamp mark-struck ${WORD}`} aria-label="Cancelled">
        Cancelled
      </span>
    )
  }

  return (
    <span
      className={`text-ink-3 inline-flex items-center gap-1.5 ${WORD}`}
      aria-label="Draft, not yet filed"
    >
      <DraftNotch />
      <span className="mark-stamp">Draft</span>
    </span>
  )
}

/**
 * Marks the query's hits inside a string without recolouring or reordering the
 * record. Case-insensitive, and it never re-parses the string as markup.
 */
export function MarkedText({ text, query }: { text: string; query?: string }) {
  const needle = query?.trim()
  if (!needle) return <>{text}</>

  const lower = text.toLowerCase()
  const target = needle.toLowerCase()
  const parts: React.ReactNode[] = []
  let cursor = 0

  for (;;) {
    const found = lower.indexOf(target, cursor)
    if (found === -1) break
    if (found > cursor) parts.push(text.slice(cursor, found))
    parts.push(
      <mark key={`${found}-${parts.length}`} className="mark-hit">
        {text.slice(found, found + target.length)}
      </mark>,
    )
    cursor = found + target.length
  }

  if (cursor === 0) return <>{text}</>
  if (cursor < text.length) parts.push(text.slice(cursor))
  return <>{parts}</>
}
