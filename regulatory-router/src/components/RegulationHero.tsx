'use client'

import { useEffect, useState } from 'react'

/**
 * Matches the first-ocean.com hero: deep navy ground, one oversized tightly-tracked
 * headline with a single accent word, and a scroll-driven fade that hands off to the
 * working surface below.
 */
export function RegulationHero({
  markets,
  routes,
  programs,
}: {
  markets: number
  routes: number
  programs: number
}) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    function onScroll() {
      setProgress(Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 0.55))))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <section className="relative flex min-h-[86vh] items-center bg-[#071a2b] overflow-hidden">
      {/* a faint routing graph, echoing the network the tool actually solves */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.13]"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 1200 700"
      >
        {[
          [140, 200, 430, 150], [140, 200, 400, 330], [430, 150, 720, 210],
          [400, 330, 720, 210], [400, 330, 690, 430], [720, 210, 1010, 180],
          [690, 430, 1010, 180], [690, 430, 1030, 500], [430, 150, 400, 330],
          [720, 210, 690, 430],
        ].map(([x1, y1, x2, y2], i) => (
          <line
            key={i}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#4a72e8"
            strokeWidth={1.2}
            className="fo-fade-in"
            style={{ animationDelay: `${400 + i * 90}ms` }}
          />
        ))}
        {[
          [140, 200], [430, 150], [400, 330], [720, 210], [690, 430], [1010, 180], [1030, 500],
        ].map(([cx, cy], i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={i === 0 ? 9 : 6}
            fill={i === 0 ? '#4a72e8' : '#ffffff'}
            className="fo-fade-in"
            style={{ animationDelay: `${300 + i * 110}ms` }}
          />
        ))}
      </svg>

      <div
        className="relative mx-auto w-full max-w-[1100px] px-6 md:px-10"
        style={{
          opacity: 1 - progress,
          transform: `translateY(${-progress * 24}px)`,
          transition: 'opacity 0.1s linear, transform 0.1s linear',
          willChange: 'opacity, transform',
        }}
      >
        <p
          className="fo-fade-up text-sm font-semibold uppercase tracking-[0.18em] text-[#4a72e8]"
          style={{ animationDelay: '80ms' }}
        >
          Regulatory pathway router
        </p>

        <h1
          className="fo-fade-up mt-6 max-w-[18ch] font-sans text-[34px] font-semibold leading-[1.08] tracking-[-0.02em] text-white md:max-w-[22ch] md:text-[58px] lg:text-[68px]"
          style={{ animationDelay: '180ms' }}
        >
          The order you file in is an <span className="text-[#4a72e8]">optimisation problem</span>.
        </h1>

        <p
          className="fo-fade-up mt-7 max-w-[62ch] text-base leading-relaxed text-white/70 md:text-lg"
          style={{ animationDelay: '300ms' }}
        >
          Approval by one regulator unlocks faster, cheaper routes in another. Describe an asset
          and this computes the filing sequence that covers your markets in the least time and
          money, and shows what reference pricing does to the answer.
        </p>

        <div className="fo-fade-up mt-10 flex flex-wrap items-center gap-4" style={{ animationDelay: '420ms' }}>
          <a
            href="#router"
            className="inline-flex items-center rounded-[10px] bg-white px-7 py-3.5 font-sans text-base font-semibold text-ink transition-colors hover:bg-white/90"
          >
            Compute a pathway
          </a>
          <a
            href="#how"
            className="inline-flex items-center rounded-[10px] border border-white/25 px-7 py-3.5 font-sans text-base font-semibold text-white transition-colors hover:bg-white/10"
          >
            How it works
          </a>
        </div>

        <dl
          className="fo-fade-up mt-14 flex flex-wrap gap-x-14 gap-y-6 border-t border-white/15 pt-8"
          style={{ animationDelay: '540ms' }}
        >
          {[
            { n: markets, l: 'markets' },
            { n: routes, l: 'filing routes' },
            { n: programs, l: 'reliance programmes' },
          ].map((s) => (
            <div key={s.l}>
              <dt className="tnum text-3xl font-semibold text-white md:text-4xl">{s.n}</dt>
              <dd className="mt-1 text-sm text-white/55">{s.l}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
