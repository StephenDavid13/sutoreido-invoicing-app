'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import React, { useEffect, useState, useTransition } from 'react'

/**
 * The query layer, at the head of the tab rail rather than the top right.
 *
 * Typing does not reorder or recolour the archive: the server marks hits over an
 * unchanged ground, and clearing the query leaves everything exactly where it
 * was. That is the one interaction this surface is built around.
 *
 * It degrades honestly: without JS the enclosing form still submits by GET and
 * the server renders the same marked result.
 */
export function ArchiveSearch({ id, placeholder }: { id: string; placeholder: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const current = params.get('q') ?? ''

  const [value, setValue] = useState(current)
  const [pending, startTransition] = useTransition()

  // Re-sync when navigation changes the query from outside this input.
  const [synced, setSynced] = useState(current)
  if (current !== synced) {
    setSynced(current)
    setValue(current)
  }

  useEffect(() => {
    if (value === current) return
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString())
      if (value.trim()) next.set('q', value.trim())
      else next.delete('q')
      startTransition(() => router.replace(`/?${next.toString()}`, { scroll: false }))
    }, 160)
    return () => clearTimeout(timer)
  }, [value, current, params, router])

  return (
    <div>
      <label htmlFor={id} className="sr-only">
        Search the archive by client or by what the work was
      </label>
      <div className="flex items-baseline gap-2 px-4 py-3">
        <span aria-hidden className="text-ink-3 text-[11px] font-semibold uppercase tracking-[0.14em]">
          Find
        </span>
        <input
          id={id}
          name="q"
          type="search"
          autoComplete="off"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          className="text-ink placeholder:text-ink-3 min-w-0 flex-1 bg-transparent text-[15px] outline-none"
        />
        {value ? (
          <button
            type="button"
            onClick={() => setValue('')}
            className="text-ink-3 hover:text-ink shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors"
          >
            Clear
          </button>
        ) : null}
      </div>
      {/*
        A one-pixel course under the input carries the pending state, so a
        keystroke never moves the layout it is filtering.
      */}
      <div
        aria-hidden
        className="bg-reserved h-px origin-left transition-transform duration-200"
        style={{ transform: `scaleX(${pending ? 1 : 0})` }}
      />
    </div>
  )
}
