'use client'

import { useEffect, useState } from 'react'

/**
 * The solve itself finishes in well under a second, which reads as "nothing happened".
 * These stages narrate the work the solver genuinely does, paced by MIN_SOLVE_MS in
 * Router so the sequence is legible rather than a flash.
 */
export const SOLVE_STAGES = [
  'Resolving eligible routes for this asset',
  'Expanding the reliance graph',
  'Enumerating reference-regulator subsets',
  'Scheduling filings against prerequisites',
  'Taking the Pareto frontier',
]

export function Computing({ stage }: { stage: number }) {
  const [dots, setDots] = useState('')

  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d.length >= 3 ? '' : `${d}.`)), 400)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="fo-fade-in border p-10">
      <div className="flex flex-col items-center text-center">
        <svg width={56} height={56} viewBox="0 0 50 50" role="img" aria-label="Computing">
          <circle cx="25" cy="25" r="20" fill="none" stroke="var(--line)" strokeWidth="3" />
          <circle
            className="fo-spin fo-dash"
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke="var(--brand)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>

        <p className="mt-5 text-sm font-medium" aria-live="polite">
          {SOLVE_STAGES[Math.min(stage, SOLVE_STAGES.length - 1)]}
          <span className="inline-block w-4 text-left">{dots}</span>
        </p>

        <ol className="mt-6 w-full max-w-md space-y-1.5 text-left">
          {SOLVE_STAGES.map((s, i) => {
            const done = i < stage
            const active = i === stage
            return (
              <li
                key={s}
                className={`flex items-center gap-2.5 text-xs transition-colors duration-300 ${
                  done ? 'text-ink' : active ? 'text-brand' : 'text-ink-soft/45'
                }`}
              >
                <span
                  className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-300 ${
                    done ? 'bg-ink' : active ? 'bg-brand' : 'bg-ink-soft/30'
                  }`}
                />
                {s}
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
