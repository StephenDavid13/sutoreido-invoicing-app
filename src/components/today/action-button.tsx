'use client'

import React, { useState, useTransition } from 'react'

import type { ActionResult } from '@/app/(app)/today/actions'

/**
 * The worklist's one control.
 *
 * A text button, not a filled one. This world has two accents with strictly
 * separated jobs — reserved marks the query and the open matter, stamp marks a
 * state needing action — so neither is available to paint a button, and a
 * coloured chip would be a container in a world built from hairlines. Weight and
 * an underline carry the affordance instead.
 *
 * It always reports what happened. A pending state that resolves to silence is
 * how an operator ends up believing an email went out when it did not, which is
 * the single failure this product has already been bitten by.
 */
export function ActionButton({
  action,
  label,
  pendingLabel,
  primary = false,
  confirm,
  disabledReason,
}: {
  action: () => Promise<ActionResult>
  label: string
  pendingLabel: string
  /** The one obvious next step on a row. At most one per row. */
  primary?: boolean
  /** When set, the first click asks and the second commits. */
  confirm?: string
  /** Renders the control inert and says why, rather than hiding it. */
  disabledReason?: string | null
}) {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<ActionResult | null>(null)
  const [asking, setAsking] = useState(false)

  const run = () => {
    if (confirm && !asking) {
      setAsking(true)
      return
    }
    setAsking(false)
    setResult(null)
    startTransition(async () => {
      setResult(await action())
    })
  }

  if (disabledReason) {
    return (
      <span className="text-ink-3 text-[11px] leading-relaxed">
        <span className="font-semibold uppercase tracking-[0.1em] line-through decoration-1">
          {label}
        </span>{' '}
        — {disabledReason}
      </span>
    )
  }

  // Once an action has succeeded the row is about to disappear on revalidation,
  // so the button is replaced by its outcome rather than inviting a second click.
  if (result?.ok) {
    return <span className="text-ink-2 text-[12px] leading-relaxed">{result.message}</span>
  }

  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className={`shrink-0 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors disabled:cursor-wait ${
          primary
            ? 'text-ink hover:text-ink-2 underline decoration-1'
            : 'text-ink-3 hover:text-ink'
        }`}
      >
        {pending ? pendingLabel : asking ? 'Sure?' : label}
      </button>

      {asking && !pending ? (
        <>
          <span className="text-ink-3 text-[11px] leading-relaxed">{confirm}</span>
          <button
            type="button"
            onClick={() => setAsking(false)}
            className="text-ink-3 hover:text-ink shrink-0 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors"
          >
            Keep it
          </button>
        </>
      ) : null}

      {/*
        Stamp ink, deliberately: this is the world's mark for a state that needs
        acting on, and a failed send is exactly that. It stays ink on text — the
        stamp never becomes a container or a badge.
      */}
      {result && !result.ok ? (
        <span className="text-stamp text-[12px] leading-relaxed">{result.message}</span>
      ) : null}
    </span>
  )
}
