'use client'

import { Button, useDocumentInfo } from '@payloadcms/ui'
import React, { useEffect, useRef, useState } from 'react'

import { copyText, shareUrl } from '@/lib/browser/clipboard'

/**
 * The client link, for the invoice edit view sidebar.
 *
 * This is the page a client opens: a readable web document rather than a PDF
 * download, at an opaque per-invoice token. Handing it over used to mean opening
 * the page and selecting the address bar.
 *
 * The token is minted when the invoice is issued, not when it is created, so a
 * draft genuinely has no link. That is deliberate — the portal is public to
 * anyone holding the token, and a draft is not a document anyone should be
 * reading — so this says so rather than showing a dead control.
 */
export function InvoiceShareLink() {
  const { id, savedDocumentData } = useDocumentInfo()
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const field = useRef<HTMLInputElement>(null)

  const token = (savedDocumentData as { shareToken?: string } | undefined)?.shareToken
  const status = (savedDocumentData as { status?: string } | undefined)?.status

  /**
   * `window` does not exist while this renders on the server, so the absolute
   * URL cannot be part of the rendered output without a hydration mismatch.
   * The input ships with the relative path and this upgrades it in place after
   * mount — writing to the DOM rather than to state, which is what an effect is
   * for and avoids a second render pass.
   */
  useEffect(() => {
    if (token && field.current) field.current.value = shareUrl(token)
  }, [token])

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  if (!id || !token) {
    return (
      <div className="field-type">
        <Button buttonStyle="secondary" size="small" disabled margin={false}>
          Copy client link
        </Button>
        <div className="field-description">
          {!id
            ? 'Save the invoice first.'
            : status === 'cancelled'
              ? 'This invoice was cancelled, so it has no client link.'
              : 'Created when the invoice is issued. Send it, and the link appears here.'}
        </div>
      </div>
    )
  }

  const run = async () => {
    const outcome = await copyText(field.current?.value || shareUrl(token))
    setState(outcome === 'failed' ? 'failed' : 'copied')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), 2400)
  }

  return (
    <div className="field-type">
      <Button buttonStyle="secondary" size="small" margin={false} onClick={run}>
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy client link'}
      </Button>{' '}
      <Button el="anchor" url={`/i/${token}`} newTab buttonStyle="none" size="small" margin={false}>
        Open
      </Button>

      {/*
        The link itself, readable and selectable. If the clipboard is
        unavailable — it needs a secure context, so plain http on a LAN address
        has none — selecting this by hand is the way out, and hiding the URL
        would remove that.
      */}
      <input
        ref={field}
        readOnly
        defaultValue={`/i/${token}`}
        onFocus={(event) => event.currentTarget.select()}
        aria-label="Client link"
        style={{
          width: '100%',
          marginTop: '0.5rem',
          padding: '0.35rem 0.5rem',
          font: 'inherit',
          fontSize: '0.7rem',
          color: 'var(--theme-elevation-600)',
          background: 'var(--theme-elevation-50)',
          border: '1px solid var(--theme-elevation-150)',
          borderRadius: 0,
        }}
      />

      <div className="field-description">
        {state === 'failed'
          ? 'Could not reach the clipboard — select the link above and copy it.'
          : 'Anyone with this link can read the invoice, so treat it like the document itself.'}
      </div>
    </div>
  )
}
