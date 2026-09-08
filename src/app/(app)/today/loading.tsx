import React from 'react'

/**
 * The worklist's loading state, shaped like the worklist it becomes.
 *
 * It needs to exist separately from the archive's: `(app)/loading.tsx` covers
 * the whole route group, so without this file /today flashed a two-column
 * skeleton with a client rail it does not have, and announced "Loading the
 * archive" to screen readers.
 *
 * No spinner. Nothing here is indeterminate, and the shape says more.
 */
export default function TodayLoading() {
  return (
    <div className="min-h-screen">
      <div className="border-rule flex h-[60px] items-center border-b px-5">
        <span className="text-ink text-[15px] font-semibold tracking-[0.02em]">Sutoreido</span>
      </div>

      <div className="border-rule border-b px-5 py-8 md:px-8 md:py-10">
        <div className="bg-bench-lip h-[34px] w-56" />
        <div className="bg-bench-course mt-5 h-[15px] w-80 max-w-full" />
      </div>

      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="border-rule border-b px-5 py-6 md:px-8 md:py-7">
          <div className="flex items-baseline gap-4">
            <div className="bg-bench-lip h-[13px] w-20 shrink-0" />
            <div className="bg-bench-lip h-[15px] flex-1" style={{ width: `${62 - index * 6}%` }} />
          </div>
          <div className="bg-bench-course mt-5 h-[12px] w-28" />
        </div>
      ))}

      <span className="sr-only" role="status">
        Working out what needs you
      </span>
    </div>
  )
}
