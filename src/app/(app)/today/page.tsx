import Link from 'next/link'
import React from 'react'

import { Header } from '@/components/shell/header'
import { Worklist } from '@/components/today/worklist'
import { requireSession } from '@/lib/auth/dal'
import { formatMoneyExplicit } from '@/lib/money/money'
import { getWorklist, totalAtStake } from '@/lib/today/queries'

/**
 * What needs you — the decision surface.
 *
 * Ranked by consequence, not by date: money that will be lost outranks money
 * that is late. The full argument for the ordering is in @/lib/today/queries.
 *
 * Dynamic by necessity. Every figure is scoped to the signed-in owner, so
 * nothing here can be prerendered or cached across users.
 */
export const dynamic = 'force-dynamic'

export const metadata = { title: 'Today' }

export default async function TodayPage() {
  const { payload, user } = await requireSession()
  const items = await getWorklist({ payload, ownerId: Number(user.id) })
  const stake = totalAtStake(items)

  return (
    <div className="min-h-screen">
      <Header current="today" />

      <main>
        <div className="border-rule border-b px-5 py-8 md:px-8 md:py-10">
          <h1 className="text-ink text-[26px] leading-[1.1] font-semibold tracking-[-0.02em] md:text-[34px]">
            {items.length > 0 ? 'What needs you' : 'Nothing needs you'}
          </h1>

          {/*
            No reserved rule under this heading, unlike the archive's. That ink
            marks the active query and the open matter, and this surface has
            neither — borrowing it here would make the accent mean "a heading".
          */}

          <p className="text-ink-2 mt-4 max-w-[65ch] text-[14px] leading-relaxed md:text-[15px]">
            {items.length > 0 ? (
              <>
                <span className="text-ink figure font-semibold tabular-nums">{items.length}</span>{' '}
                {items.length === 1 ? 'thing needs' : 'things need'} a decision, worst first.
                {stake.length > 0 ? (
                  <>
                    {' '}
                    <Stake rows={stake} /> {stake.length > 1 ? 'are' : 'is'} riding on
                    them.
                  </>
                ) : null}
              </>
            ) : (
              <>
                Nothing is overdue, no recurring period is unbilled, and the outbox is empty. The
                billing run and the reminder sweep both check daily and will file anything here that
                needs you.
              </>
            )}
          </p>
        </div>

        {items.length > 0 ? <Worklist items={items} /> : <Quiet />}
      </main>
    </div>
  )
}

/**
 * The money at stake, per currency and never totalled. An AUD and an NZD
 * balance have no common sum without a recorded rate, and this app records none.
 */
function Stake({ rows }: { rows: { currency: 'AUD' | 'NZD' | 'USD' | 'PHP'; cents: number }[] }) {
  return (
    <>
      {rows.map((row, index) => (
        <React.Fragment key={row.currency}>
          {index > 0 ? ' and ' : ''}
          <span className="text-ink figure font-semibold tabular-nums">
            {formatMoneyExplicit(row.cents, row.currency)}
          </span>
        </React.Fragment>
      ))}
    </>
  )
}

/**
 * The quiet state, composed rather than apologised for.
 *
 * This is the page's commonest rendering for a one-person practice, and treating
 * it as an error condition would make the product feel broken most of the time.
 * It says what is true and where the next thing comes from.
 */
function Quiet() {
  return (
    <div className="px-5 py-14 md:px-8 md:py-20">
      <div className="max-w-[52ch]">
        {/*
          A closed file resting on the bench: the drawn counterpart to the
          archive's empty plate, so the two quiet states read as one family.
        */}
        <svg
          aria-hidden
          viewBox="0 0 80 96"
          className="text-ink-3 mb-6 h-24 w-20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
        >
          <path d="M4 4h48l24 24v64H4z" />
          <path d="M52 4v24h24" />
          <path d="M16 46h40M16 58h40M16 70h26" strokeOpacity="0.45" />
        </svg>

        <h2 className="text-ink text-[19px] font-semibold tracking-[-0.01em]">The bench is clear</h2>
        <p className="text-ink-2 mt-2 text-[14px] leading-relaxed">
          Everything sent is either paid or not yet due. When a hosting period comes round, a due
          date passes, or a chase email is composed, it appears here as a row with the action on it.
        </p>
        <div className="mt-5 flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <Link
            href="/"
            className="text-ink hover:text-ink-2 text-[13px] font-semibold uppercase tracking-[0.1em] underline decoration-1 transition-colors"
          >
            Open the archive
          </Link>
          <Link
            href="/admin/collections/invoices/create"
            className="text-ink-3 hover:text-ink text-[13px] font-semibold uppercase tracking-[0.1em] transition-colors"
          >
            Raise an invoice
          </Link>
        </div>
      </div>
    </div>
  )
}
