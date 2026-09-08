import Link from 'next/link'
import React from 'react'

import { NotesPanel } from '@/components/shell/notes-panel'
import { requireSession } from '@/lib/auth/dal'
import { getNotifications } from '@/lib/today/queries'

/**
 * The bench's edge: the same header on every operator surface.
 *
 * Two surfaces now exist and they answer different questions — /today is "what
 * needs me", / is "what is on record" — so the header has to name both. It was
 * inlined in the archive page before there was anywhere else to go.
 *
 * The current surface is marked with ink weight rather than an accent. Both
 * accents in this world have one job each and neither is available: reserved
 * belongs to the query and the open matter, stamp to a state needing action.
 * Chrome does not get to borrow them.
 */

const NAV = [
  { href: '/today', label: 'Today', key: 'today' as const },
  { href: '/', label: 'Archive', key: 'archive' as const },
]

export async function Header({ current }: { current: 'today' | 'archive' }) {
  const { payload, user } = await requireSession()
  const { rows, unread } = await getNotifications({ payload, ownerId: Number(user.id) })

  return (
    <header className="border-rule flex h-[60px] items-center justify-between gap-3 border-b px-5 sm:gap-5">
      <div className="flex min-w-0 items-baseline gap-4 sm:gap-6">
        <Link href="/today" className="text-ink shrink-0 text-[15px] font-semibold tracking-[0.02em]">
          Sutoreido
        </Link>

        <nav className="flex items-baseline gap-3 sm:gap-5">
          {NAV.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              aria-current={current === item.key ? 'page' : undefined}
              className={`text-[12px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                current === item.key ? 'text-ink' : 'text-ink-3 hover:text-ink'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex shrink-0 items-baseline gap-3 sm:gap-5">
        <NotesPanel rows={rows} unread={unread} />
        <Link
          href="/admin"
          className="text-ink-3 hover:text-ink text-[12px] font-semibold uppercase tracking-[0.12em] transition-colors"
        >
          {/*
            The widest label on the row and the least-used destination, so it is
            the one that gives way. At 390px the full set — wordmark, two nav
            items, Notes and this — overflows the 350px of usable width, and this
            world forbids a horizontally scrolling page.
          */}
          <span className="sm:hidden">Admin</span>
          <span className="hidden sm:inline">Back office</span>
        </Link>
      </div>
    </header>
  )
}
