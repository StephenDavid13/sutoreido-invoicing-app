'use client'

import React, { useState, useTransition } from 'react'

import { recordPaymentAction, type ActionResult } from '@/app/(app)/today/actions'
import type { CurrencyCode } from '@/lib/money/currencies'

/**
 * Recording a payment — the action that actually settles an invoice.
 *
 * Inline disclosure rather than a dialog. Nothing here needs protected focus or
 * an interruption, and a modal would hide the row whose balance the operator is
 * reading off while they type.
 *
 * The amount is prefilled with the outstanding balance because settling in full
 * is overwhelmingly the common case, and part payments are then a correction to
 * a number already in front of you rather than something to work out.
 */

/** The local calendar date. `toISOString()` alone would hand back yesterday. */
function todayLocal(): string {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

const FIELD =
  'text-ink border-rule focus:border-ink-2 min-w-0 border-0 border-b bg-transparent pb-1 text-[14px] outline-none transition-colors'
const LABEL = 'text-ink-3 block text-[10px] font-semibold uppercase tracking-[0.12em]'

export function RecordPayment({
  invoiceId,
  currency,
  balanceCents,
}: {
  invoiceId: number
  currency: CurrencyCode
  balanceCents: number
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<ActionResult | null>(null)

  const [amount, setAmount] = useState(() => (balanceCents / 100).toFixed(2))
  const [receivedOn, setReceivedOn] = useState(todayLocal)
  const [method, setMethod] = useState('bank_transfer')
  const [reference, setReference] = useState('')

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setResult(null)
    startTransition(async () => {
      const outcome = await recordPaymentAction({
        invoiceId,
        amount,
        receivedOn,
        method,
        reference,
      })
      setResult(outcome)
      if (outcome.ok) setOpen(false)
    })
  }

  if (result?.ok) {
    return <span className="text-ink-2 text-[12px] leading-relaxed">{result.message}</span>
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-ink hover:text-ink-2 shrink-0 text-[11px] font-semibold uppercase tracking-[0.1em] underline decoration-1 transition-colors"
      >
        Record payment
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="course-step w-full max-w-[38rem]">
      <div className="flex flex-wrap items-end gap-x-5 gap-y-4">
        <div className="w-[9rem]">
          <label className={LABEL} htmlFor={`amount-${invoiceId}`}>
            Amount ({currency})
          </label>
          <input
            id={`amount-${invoiceId}`}
            name="amount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className={`${FIELD} figure w-full tabular-nums`}
          />
        </div>

        <div className="w-[10rem]">
          <label className={LABEL} htmlFor={`received-${invoiceId}`}>
            Money arrived
          </label>
          <input
            id={`received-${invoiceId}`}
            name="receivedOn"
            type="date"
            required
            value={receivedOn}
            onChange={(event) => setReceivedOn(event.target.value)}
            className={`${FIELD} figure w-full tabular-nums`}
          />
        </div>

        <div className="w-[9rem]">
          <label className={LABEL} htmlFor={`method-${invoiceId}`}>
            How
          </label>
          <select
            id={`method-${invoiceId}`}
            name="method"
            value={method}
            onChange={(event) => setMethod(event.target.value)}
            className={`${FIELD} w-full`}
          >
            <option value="bank_transfer">Bank transfer</option>
            <option value="card">Card</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="w-[11rem] flex-1">
          <label className={LABEL} htmlFor={`reference-${invoiceId}`}>
            Bank reference
          </label>
          <input
            id={`reference-${invoiceId}`}
            name="reference"
            type="text"
            autoComplete="off"
            placeholder="Optional"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            className={`${FIELD} placeholder:text-ink-3 w-full`}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <button
          type="submit"
          disabled={pending}
          className="text-ink hover:text-ink-2 shrink-0 text-[11px] font-semibold uppercase tracking-[0.1em] underline decoration-1 transition-colors disabled:cursor-wait"
        >
          {pending ? 'Recording…' : 'Record it'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setResult(null)
          }}
          className="text-ink-3 hover:text-ink shrink-0 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors"
        >
          Cancel
        </button>
        {result && !result.ok ? (
          <span className="text-stamp text-[12px] leading-relaxed">{result.message}</span>
        ) : null}
      </div>
    </form>
  )
}
