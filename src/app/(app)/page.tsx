import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { ArchiveSearch } from '@/components/archive/archive-search'
import { Docket } from '@/components/archive/docket'
import { MatterRail } from '@/components/archive/matter-rail'
import { Owing, Standing } from '@/components/archive/standing'
import {
  getArchiveStanding,
  getDocket,
  getMatterIndex,
  type ArchiveStanding,
} from '@/lib/archive/queries'
import { requireSession } from '@/lib/auth/dal'

/**
 * The archive, spined by the client.
 *
 * Dynamic by necessity: every figure is scoped to the signed-in owner, so nothing
 * here can be prerendered or cached across users.
 */
export const dynamic = 'force-dynamic'

type Params = { searchParams: Promise<{ client?: string; q?: string; view?: string }> }

/**
 * One clause describing how old the unpaid money is, or null when there is nothing
 * worth saying. Never summed or compared across currencies.
 */
function describeAge(groups: ArchiveStanding['agingByCurrency']): string | null {
  const populated = groups.flatMap((g) =>
    g.buckets.filter((b) => b.cents > 0).map((b) => b.label),
  )
  const distinct = [...new Set(populated)]
  if (distinct.length === 0) return null
  if (distinct.length === 1) {
    return distinct[0] === 'undated'
      ? 'none of it with a due date'
      : `all of it ${distinct[0]} days out`
  }
  const oldest = ['90+', '61-90', '31-60', '0-30'].find((label) => distinct.includes(label))
  return oldest ? `the oldest ${oldest} days out` : null
}

export default async function ArchivePage({ searchParams }: Params) {
  const { client, q, view } = await searchParams
  const query = q?.trim() || undefined
  const activeClientId = client && /^\d+$/.test(client) ? Number(client) : null

  const { payload, user } = await requireSession()
  const ownerId = Number(user.id)

  const [tabs, entries, standing] = await Promise.all([
    getMatterIndex({ payload, ownerId, query }),
    getDocket({ payload, ownerId, clientId: activeClientId, query }),
    getArchiveStanding({ payload, ownerId }),
  ])

  const openTab = activeClientId ? tabs.find((t) => t.clientId === activeClientId) : undefined

  /**
   * The age of what is unpaid, as a clause rather than a block.
   *
   * It used to be a panel pinned to the bottom of the rail, where it read as a
   * stray figure with no owner. It belongs to the same thought as the amount, so
   * it now finishes that sentence — and it says nothing at all when there is
   * nothing to say.
   */
  const ageNote = describeAge(standing.agingByCurrency)

  // A client id that is not in this owner's roster is not found, never a silently
  // empty "Every filing". Same rule as everywhere else: a row belonging to
  // someone else reads as missing, and it never renders as a different view.
  if (activeClientId !== null && !openTab) notFound()
  // Raise from the declined guide-map hand: at narrow widths one field is all
  // there is, rather than two columns shrunk until the type has to give way.
  // `view=all` is how the cross-client docket is reached on a narrow screen,
  // where the rail and the matter are never on screen together.
  const matterIsOpen = activeClientId !== null || Boolean(query) || view === 'all'

  const filedCount = entries.length

  /**
   * Owing always describes the set the sentence above it just counted. Showing
   * archive-wide owing beside a filtered count reads as though those five rows
   * owe the whole archive's balance.
   */
  const owing = (() => {
    if (query) {
      const byCurrency = new Map<string, number>()
      for (const entry of entries) {
        if (entry.status !== 'sent' && entry.status !== 'overdue') continue
        byCurrency.set(entry.currency, (byCurrency.get(entry.currency) ?? 0) + entry.balanceCents)
      }
      return [...byCurrency.entries()]
        .filter(([, cents]) => cents > 0)
        .map(([currency, cents]) => ({ currency: currency as typeof entries[number]['currency'], cents }))
        .sort((a, b) => b.cents - a.cents)
    }
    if (openTab) {
      return openTab.outstandingCents > 0
        ? [{ currency: openTab.currency, cents: openTab.outstandingCents }]
        : []
    }
    return standing.outstandingByCurrency
  })()

  return (
    <div className="min-h-screen">
      <header className="border-rule flex h-[60px] items-center justify-between border-b px-5">
        <Link href="/" className="text-ink text-[15px] font-semibold tracking-[0.02em]">
          Sutoreido
        </Link>
        <Link
          href="/admin"
          className="text-ink-2 hover:text-ink text-[12px] font-semibold uppercase tracking-[0.12em] transition-colors"
        >
          Back office
        </Link>
      </header>

      {/*
        Above the split on purpose. Inside the rail it disappeared on mobile the
        moment a matter opened, which took the query field and its Clear with it.
      */}
      <div className="md:hidden">
        <ArchiveSearch id="archive-q-narrow" placeholder="Client, or what the work was" />
      </div>

      <div className="flex min-h-[calc(100vh-60px)] flex-col md:flex-row">
        {/* The spine. Its own scroll, so the docket never drags the roster with it. */}
        <aside
          className={`border-rule shrink-0 border-b md:sticky md:top-0 md:flex md:h-[calc(100vh-60px)] md:w-[20rem] md:flex-col md:border-b-0 md:border-r ${
            matterIsOpen ? 'hidden md:flex' : 'block'
          }`}
        >
          <div className="border-rule hidden border-b md:block">
            <ArchiveSearch id="archive-q-wide" placeholder="Client, or what the work was" />
          </div>
          <MatterRail tabs={tabs} activeClientId={activeClientId} query={query} />
        </aside>

        {/* The open matter, owning the rest of the bench. */}
        <main className={`min-w-0 flex-1 ${matterIsOpen ? 'block' : 'hidden md:block'}`}>
          <div className="border-rule border-b px-5 py-8 md:px-8 md:py-10">
            {matterIsOpen ? (
              <Link
                href="/"
                className="text-ink-3 hover:text-ink mb-4 inline-block text-[12px] font-semibold uppercase tracking-[0.12em] transition-colors md:hidden"
              >
                All files
              </Link>
            ) : null}

            <h1 className="text-ink text-[26px] leading-[1.1] font-semibold tracking-[-0.02em] md:text-[34px]">
              {openTab ? openTab.name : 'Every filing'}
            </h1>
            {/* Reserved ink, marking which matter is open. Its other job is the query. */}
            <div aria-hidden className="bg-reserved mt-4 h-[2px] w-14" />

            {/* The standing, as a sentence. Not a row of metric tiles. */}
            <p className="text-ink-2 mt-3 max-w-[65ch] text-[14px] leading-relaxed md:text-[15px]">
              <Standing
                query={query}
                matches={filedCount}
                openTab={openTab}
                standing={standing}
              />
            </p>

            {owing.length > 0 ? (
              <p className="text-ink-2 mt-2 max-w-[65ch] text-[14px] leading-relaxed md:text-[15px]">
                <Owing rows={owing} ageNote={!query && !openTab ? ageNote : null} />
              </p>
            ) : null}

          </div>

          {entries.length > 0 ? (
            <Docket entries={entries} query={query} showClient={!openTab} />
          ) : (
            <EmptyDocket query={query} clientName={openTab?.name} />
          )}
        </main>
      </div>
    </div>
  )
}

/**
 * The empty state, composed rather than apologised for. This archive is small and
 * will often land here, so it is a first-class view: it names what is missing and
 * where the next filing comes from.
 */
function EmptyDocket({ query, clientName }: { query?: string; clientName?: string }) {
  return (
    <div className="px-5 py-14 md:px-8 md:py-20">
      <div className="max-w-[52ch]">
        {/* A blank plate on the bench: the file is open and there is nothing in it. */}
        <div
          aria-hidden
          className="border-rule mb-6 h-24 w-20 border border-dashed"
          style={{ background: 'var(--bench-course)' }}
        />
        <h2 className="text-ink text-[19px] font-semibold tracking-[-0.01em]">
          {query ? 'Nothing matches that' : 'This file is empty'}
        </h2>
        <p className="text-ink-2 mt-2 text-[14px] leading-relaxed">
          {query ? (
            <>
              No filing mentions <span className="mark-hit">{query}</span> in a client name, a
              title, or a line of work. Try a shorter fragment, or clear the search to see the whole
              archive.
            </>
          ) : clientName ? (
            <>
              Nothing has been invoiced to {clientName} yet. Raise the first invoice in the back
              office and it will be filed here the moment it is sent.
            </>
          ) : (
            <>
              No invoices have been filed. Raise one in the back office, or let the billing run
              raise it from a recurring service.
            </>
          )}
        </p>
        {!query ? (
          <Link
            href="/admin/collections/invoices/create"
            className="text-ink hover:text-ink-2 mt-5 inline-block text-[13px] font-semibold uppercase tracking-[0.1em] underline decoration-1 transition-colors"
          >
            Raise an invoice
          </Link>
        ) : null}
      </div>
    </div>
  )
}
