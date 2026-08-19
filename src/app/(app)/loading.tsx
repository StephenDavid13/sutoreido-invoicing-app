import React from 'react'

/**
 * The loading state, shaped like the docket it becomes.
 *
 * Courses of the right height in the right rhythm, so the layout does not jump
 * when the real rows arrive. No spinner: nothing here is indeterminate, and a
 * spinner would say less than the shape does.
 */
export default function ArchiveLoading() {
  return (
    <div className="min-h-screen">
      <div className="border-rule-strong flex h-[60px] items-center border-b px-5">
        <span className="text-ink text-[15px] font-semibold tracking-[0.02em]">Sutoreido</span>
      </div>

      <div className="flex min-h-[calc(100vh-60px)] flex-col md:flex-row">
        <div className="border-rule-strong shrink-0 border-b md:h-[calc(100vh-60px)] md:w-[20rem] md:border-b-0 md:border-r">
          <div className="border-rule-strong border-b px-4 py-3">
            <div className="bg-bench-lip h-[19px] w-32" />
          </div>
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="border-rule border-b px-4 py-3">
              <div className="bg-bench-lip h-[17px]" style={{ width: `${72 - index * 7}%` }} />
              <div className="bg-bench-course mt-2 h-[13px] w-2/5" />
            </div>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="border-rule-strong border-b px-5 py-7 md:px-8 md:py-9">
            <div className="bg-bench-lip h-[34px] w-64" />
            <div className="bg-bench-course mt-4 h-[15px] w-80" />
          </div>
          {Array.from({ length: 7 }).map((_, index) => (
            <div
              key={index}
              className="border-rule grid grid-cols-[5.5rem_1fr] gap-x-6 border-b px-5 py-4 md:px-5"
            >
              <div className="bg-bench-lip h-[17px] w-10" />
              <div>
                <div className="bg-bench-lip h-[15px]" style={{ width: `${64 - index * 5}%` }} />
                <div className="bg-bench-course mt-2 h-[12px] w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <span className="sr-only" role="status">
        Loading the archive
      </span>
    </div>
  )
}
