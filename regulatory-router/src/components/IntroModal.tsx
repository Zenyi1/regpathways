'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'fo-regulation-intro-seen'

const POINTS = [
  {
    title: 'Approval unlocks approval',
    body: 'A green light from the FDA or EMA opens abridged routes elsewhere. Project Orbis, WHO prequalification, the Access Consortium and dozens of national verification pathways all shortcut review once a stringent regulator has said yes.',
  },
  {
    title: 'Price references price',
    body: 'Most countries cap a new price against a basket of other countries. Under Most Favoured Nation policy the US price is pegged to the lowest comparable one, so an early launch in a cheap market drags down the largest one.',
  },
  {
    title: 'The asset changes the graph',
    body: 'Orbis is oncology only. WHO prequalification needs an active expression of interest. Saudi fast routes exclude generics. There is no single best sequence, which is why this is solved rather than looked up.',
  },
]

export function IntroModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // deferred a frame so the server and first client render agree (both closed),
    // then the modal animates in rather than flashing during hydration
    const id = requestAnimationFrame(() => {
      try {
        if (!window.localStorage.getItem(STORAGE_KEY)) setOpen(true)
      } catch {
        setOpen(true)
      }
    })
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dismiss()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* private mode: it will simply show again next visit */
    }
    setOpen(false)
  }

  if (!open) return null

  return (
    <div
      className="fo-fade-in fixed inset-0 z-[100] flex items-center justify-center bg-[#071a2b]/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="intro-title"
      onClick={dismiss}
    >
      <div
        className="fo-scale-in relative max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-[10px] bg-white p-8 shadow-2xl md:p-10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-5 top-5 text-ink-soft transition-colors hover:text-ink"
        >
          ✕
        </button>

        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
          Regulatory pathway router
        </p>
        <h2
          id="intro-title"
          className="mt-4 max-w-[20ch] text-[28px] font-semibold leading-[1.12] tracking-[-0.02em] md:text-[34px]"
        >
          Getting a drug into 40 countries is not 40 separate decisions.
        </h2>

        <div className="mt-7 space-y-5">
          {POINTS.map((p, i) => (
            <div
              key={p.title}
              className="fo-fade-up border-l-2 border-brand/25 pl-4"
              style={{ animationDelay: `${180 + i * 110}ms` }}
            >
              <h3 className="text-sm font-semibold">{p.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{p.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-[10px] bg-brand px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-strong"
          >
            Start routing
          </button>
          <a
            href="/docs"
            className="rounded-[10px] border px-6 py-3 text-sm font-semibold transition-colors hover:bg-surface"
          >
            API reference
          </a>
        </div>

        <p className="mt-6 border-t pt-4 text-xs leading-relaxed text-ink-soft">
          Timings are agency review clocks, so they measure time to approval rather than time to
          patient. Every route links to its regulator source and carries a confidence level, and
          rows marked low confidence are estimates rather than published figures.
        </p>
      </div>
    </div>
  )
}
