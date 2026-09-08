'use client'

import Link from 'next/link'
import React, { useEffect, useRef, useState, useTransition } from 'react'

import { markNotificationsReadAction } from '@/app/(app)/today/actions'
import type { NotificationRow } from '@/lib/today/queries'

/**
 * Notes clipped into the file — what the app noticed while nobody was looking.
 *
 * Not a bell, and not an icon. A bell is the convention from chat products and
 * would be the only pictogram in a world built from stamped words and hairlines;
 * a matter file gets loose notes clipped to the front of it. The count carries
 * the urgency through the same stamped grammar as every other state here.
 *
 * These are a LOG, not the worklist. Anything actually needing a decision is a
 * row on /today with a button on it — so this panel is deliberately passive, and
 * opening it is allowed to be the end of the interaction.
 */

/** "3 days ago" without pulling in a date library for one string. */
function ago(iso: string | null): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const days = Math.floor((Date.now() - then) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  const months = Math.round(days / 30)
  return months === 1 ? 'a month ago' : `${months} months ago`
}

export function NotesPanel({ rows, unread }: { rows: NotificationRow[]; unread: number }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const wrap = useRef<HTMLDivElement>(null)

  // Dismiss on Escape and on a click that lands outside. Both, because either
  // one alone leaves a way to get stuck with the panel covering the page.
  useEffect(() => {
    if (!open) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onPointer = (event: MouseEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointer)
    }
  }, [open])

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-haspopup="true"
        className="text-ink-2 hover:text-ink inline-flex items-baseline gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] transition-colors"
      >
        Notes
        {unread > 0 ? (
          <span className="mark-stamp text-stamp text-[10px] font-semibold tabular-nums">
            {unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="border-rule-strong course-step absolute right-0 top-full z-20 mt-3 w-[min(24rem,calc(100vw-2.5rem))] border"
          style={{ background: 'var(--bench-lip)' }}
        >
          <div className="border-rule flex items-baseline justify-between gap-4 border-b px-4 py-3">
            <span className="text-ink text-[12px] font-semibold uppercase tracking-[0.12em]">
              {unread > 0 ? `${unread} unread` : 'Nothing new'}
            </span>
            {unread > 0 ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => void markNotificationsReadAction())}
                className="text-ink-3 hover:text-ink shrink-0 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors disabled:cursor-wait"
              >
                {pending ? 'Clearing…' : 'Mark all read'}
              </button>
            ) : null}
          </div>

          {rows.length === 0 ? (
            <p className="text-ink-3 px-4 py-6 text-[13px] leading-relaxed">
              The billing run and the reminder sweep write here when they do something. Nothing yet.
            </p>
          ) : (
            <ul className="max-h-[26rem] overflow-y-auto">
              {rows.map((row) => {
                const body = (
                  <>
                    <span className="flex items-baseline justify-between gap-3">
                      <span
                        className={`text-[13px] leading-snug ${
                          row.readAt ? 'text-ink-2' : 'text-ink font-semibold'
                        }`}
                      >
                        {row.title}
                      </span>
                      <span className="text-ink-3 figure shrink-0 text-[11px] tabular-nums">
                        {ago(row.createdAt)}
                      </span>
                    </span>
                    {row.body ? (
                      <span className="text-ink-3 mt-1 block text-[12px] leading-relaxed">
                        {row.body}
                      </span>
                    ) : null}
                  </>
                )

                return (
                  <li key={row.id} className="border-rule border-b last:border-b-0">
                    {row.actionUrl ? (
                      <Link
                        href={row.actionUrl}
                        onClick={() => setOpen(false)}
                        className="hover:bg-bench-course block px-4 py-3 transition-colors"
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="px-4 py-3">{body}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
