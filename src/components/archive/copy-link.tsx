'use client'

import React, { useEffect, useRef, useState } from 'react'

import { copyText, shareUrl } from '@/lib/browser/clipboard'

/**
 * Copies a filing's shareable link.
 *
 * The direction's story ends "finds it, reads it, and sends it", and until now
 * sending meant selecting the address bar — this is the affordance that was
 * named as the archive's first known gap.
 *
 * A text button, like its siblings on the row. Both accents in this world have
 * one job each — reserved for the query and the open matter, stamp for a state
 * needing action — so neither is available to paint a control, and a filled chip
 * would be a container in a world made of hairlines.
 */

export function CopyLink({
  token,
  label = 'Copy link',
}: {
  token: string
  /** Overridden where the surrounding row already says "link". */
  label?: string
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const run = async () => {
    const outcome = await copyText(shareUrl(token))
    setState(outcome === 'failed' ? 'failed' : 'copied')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), 2400)
  }

  return (
    <button
      type="button"
      onClick={run}
      // Announced rather than only shown, since the only feedback is a word change.
      aria-live="polite"
      className={`shrink-0 text-[12px] font-semibold uppercase tracking-[0.1em] transition-colors ${
        state === 'failed'
          ? 'text-stamp'
          : 'text-ink-2 hover:text-ink underline decoration-1'
      }`}
      title={state === 'failed' ? 'Could not reach the clipboard' : 'Copy the client link'}
    >
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : label}
    </button>
  )
}
