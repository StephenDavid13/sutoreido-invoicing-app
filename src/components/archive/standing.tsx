import React from 'react'

import type { ArchiveStanding, MatterTab } from '@/lib/archive/queries'
import type { CurrencyCode } from '@/lib/money/currencies'
import { formatMoneyExplicit } from '@/lib/money/money'
import { dateDDMMYYYY } from '@/lib/pdf/format'

/**
 * The cover sheet's standing, written as a sentence.
 *
 * Deliberately not a row of metric tiles: the numbers are few, and a sentence
 * says what they mean to each other in a way four boxes cannot.
 */

const Figure = ({ children }: { children: React.ReactNode }) => (
  <span className="text-ink figure font-semibold tabular-nums">{children}</span>
)

function QueryStanding({
  matches,
  query,
  scopedToFile,
}: {
  matches: number
  query: string
  scopedToFile: boolean
}) {
  return (
    <>
      <Figure>{matches}</Figure> {matches === 1 ? 'filing matches' : 'filings match'}{' '}
      <span className="mark-hit">{query}</span>
      {scopedToFile ? ' in this file' : ' across the archive'}.
    </>
  )
}

function MatterStanding({ tab }: { tab: MatterTab }) {
  if (tab.filings === 0) return <>Nothing has been filed against this client yet.</>

  return (
    <>
      <Figure>{tab.filings}</Figure> {tab.filings === 1 ? 'filing' : 'filings'},{' '}
      <span className="text-ink figure tabular-nums">
        {formatMoneyExplicit(tab.invoicedCents, tab.currency)}
      </span>{' '}
      invoiced in total
      {tab.lastFiled ? (
        <>
          , most recently <span className="figure tabular-nums">{dateDDMMYYYY(tab.lastFiled)}</span>
        </>
      ) : null}
      .
    </>
  )
}

function WholeArchiveStanding({ standing }: { standing: ArchiveStanding }) {
  return (
    <>
      <Figure>{standing.filings}</Figure> {standing.filings === 1 ? 'filing' : 'filings'} across{' '}
      <Figure>{standing.clients}</Figure> {standing.clients === 1 ? 'client' : 'clients'}.
    </>
  )
}

export function Standing({
  query,
  matches,
  openTab,
  standing,
}: {
  query?: string
  matches: number
  openTab?: MatterTab
  standing: ArchiveStanding
}) {
  if (query) {
    return <QueryStanding matches={matches} query={query} scopedToFile={Boolean(openTab)} />
  }
  if (openTab) return <MatterStanding tab={openTab} />
  return <WholeArchiveStanding standing={standing} />
}

/**
 * What is still owed. In ink, not the stamp ink: the stamp belongs to state, and
 * a money figure is not a state. Never summed across currencies.
 */
export function Owing({ rows }: { rows: { currency: CurrencyCode; cents: number }[] }) {
  if (rows.length === 0) return null
  return (
    <>
      {rows.map((row, index) => (
        <React.Fragment key={row.currency}>
          {index > 0 ? ' and ' : ''}
          <span className="text-ink figure font-semibold tabular-nums">
            {formatMoneyExplicit(row.cents, row.currency)}
          </span>
        </React.Fragment>
      ))}{' '}
      still owing.
    </>
  )
}
